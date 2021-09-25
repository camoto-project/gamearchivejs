/*
 * Prehistorik .CUR format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/CUR_Format
 *
 * Copyright (C) 2010-2021 Adam Nielsen <malvineous@shikadi.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const FORMAT_ID = 'arc-cur-prehistorik';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { cmp_lzss } from '@camoto/gamecomp';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension, getExtension } from '../util/supp.js';

const recordTypes = {
	header: {
		offData: RecordType.int.u16le,
	},
	fatHeader: {
		size: RecordType.int.u32le,
	},
	fatEntry: {
		name: RecordType.string.variable.reqTerm(13),
	},
	compressionHeader: {
		size: RecordType.int.u32be,
	},
};

const HEADER_LEN = 2; // sizeof(header)

// cmp_lzss parameters to compress/decompress files.
const cmpParams = {
	bitstream: true,
	invertFlag: false,
	lengthHigh: true,
	littleEndian: false,
	minDistance: 1,
	minLength: 2,
	prefillByte: 0x00,
	relativeDistance: true,
	rotateDistance: 0,
	sizeDistance: 8,
	sizeLength: 2,
	windowStartAt0: true,
};

export default class Archive_CUR_Prehistorik extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Prehistorik Data File',
			games: [
				'Prehistorik',
			],
			glob: [
				'*.cur',
			],
		};

		// Technically no limit but none are longer than 8.3.
		md.caps.file.maxFilenameLen = 12;

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'cur'),
		};
	}

	static identify(content) {
		const lenArchive = content.length;

		if (lenArchive < HEADER_LEN) {
			return {
				valid: false,
				reason: `Content too short (< ${HEADER_LEN} b).`,
			};
		}

		let buffer = new RecordBuffer(content);
		const header = buffer.readRecord(recordTypes.header);

		const lenFAT = header.offData;

		if (header.offData > lenArchive) {
			return {
				valid: false,
				reason: `FAT truncated (file length ${content.length} < FAT length ${lenFAT}).`,
			};
		}

		let nextOffset = header.offData;

		for (let i = 0, pos = 2; pos < header.offData; i++) {
			if (pos + 4 > header.offData) {
				return {
					valid: false,
					reason: `FAT truncated at file ${i}.`,
				};
			}
			const fatHeader = buffer.readRecord(recordTypes.fatHeader);
			pos += 4;
			if (fatHeader.size === 0) {
				// Last entry in FAT.
				if (pos !== header.offData) {
					// We've gotten to the end of the FAT but we're not at the offset of
					// the first file.  It's possible there is extra data hidden here,
					// but it's more likely this is a different file format.
					return {
						valid: undefined,
						reason: `${header.offData - pos} extra bytes at the end of the FAT.`,
					};
				}
				// Otherwise the FAT ended with a zero-length size as expected.
				break;
			}
			try {
				const fatEntry = buffer.readRecord(recordTypes.fatEntry);
				pos += fatEntry.name.length + 1;

				nextOffset += fatHeader.size;
			} catch (e) {
				return {
					valid: false,
					reason: `Error reading filename from FAT, possibly truncated.`,
				};
			}

			if (nextOffset > lenArchive) {
				return {
					valid: false,
					reason: `File ${i} ends beyond the end of the archive.`,
				};
			}
		}

		return {
			valid: true,
			reason: `All files contained within the archive.`,
		};
	}

	static parse({main: content}) {
		let archive = new Archive();
		let buffer = new RecordBuffer(content);

		const header = buffer.readRecord(recordTypes.header);

		let nextOffset = header.offData;
		for (let i = 0, pos = 2; pos < header.offData; i++) {
			const fatHeader = buffer.readRecord(recordTypes.fatHeader);
			pos += 4;
			if (fatHeader.size === 0) break; // end of FAT

			const fatEntry = buffer.readRecord(recordTypes.fatEntry);
			pos += fatEntry.name.length + 1;

			let file = new File();
			file.name = fatEntry.name;
			file.diskSize = file.nativeSize = fatHeader.size;
			file.offset = nextOffset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.attributes.compressed = this.isCompressed(file.name);

			archive.files.push(file);

			nextOffset += fatHeader.size;
		}

		// Load decompressed sizes.
		for (let file of archive.files) {
			if (file.attributes.compressed) {
				buffer.seekAbs(file.offset);
				const compressionHeader = buffer.readRecord(recordTypes.compressionHeader);
				file.nativeSize = compressionHeader.size;
				file.offset += 4;
				file.diskSize -= 4;
				file.getContent = () => (
					cmp_lzss
						.reveal(file.getRaw(), cmpParams)
						// The decompressor has trailing bytes so chop it down to the
						// length in the header.
						.slice(0, file.nativeSize)
				);
			}
		}

		return archive;
	}

	static generate(archive)
	{
		// Work out where the FAT ends and the first file starts.
		const header = {
			offData: archive.files.reduce(
				(a, b) => a + 4 + (b.name.length + 1),
				2 /* File header */ + 4 /* FAT terminator */,
			),
		};

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			header.offData,
		);

		let buffer = new RecordBuffer(finalSize);
		buffer.writeRecord(recordTypes.header, header);

		// Write FAT without compressed-file sizes first.
		for (const file of archive.files) {
			buffer.writeRecord(recordTypes.fatHeader, {
				size: file.diskSize,
			});
			buffer.writeRecord(recordTypes.fatEntry, {
				name: file.name,
			});
		}
		// Terminate the FAT with a zero-size file.
		buffer.writeRecord(recordTypes.fatHeader, {
			size: 0,
		});

		// Compress and write file content next, saving the compressed size.
		for (let file of archive.files) {
			const fileContent = file.getContent();

			// Safety check.
			if (fileContent.length != file.nativeSize) {
				throw new Error(`Length of data (${fileContent.length}) and nativeSize `
					+ `(${file.nativeSize}) field do not match for ${file.name}!`);
			}

			// Override any compression attribute with the rules that work for this
			// format.
			file.attributes.compressed = this.isCompressed(file.name);

			let diskData;
			if (file.attributes.compressed) {
				diskData = cmp_lzss.obscure(fileContent, cmpParams);

				// Decompressed size comes first before data.
				buffer.writeRecord(recordTypes.compressionHeader, {
					size: file.nativeSize,
				});
			} else {
				diskData = fileContent;
			}
			file.diskSize = diskData.length;

			buffer.put(diskData);
		}

		// Rewrite the FAT now we have compressed sizes available.
		buffer.seekAbs(2);
		for (const file of archive.files) {
			buffer.writeRecord(recordTypes.fatHeader, {
				// Include the four byte decompressed-size in the size field, because
				// we don't include it in file.diskSize.  This is because we consider
				// it part of an embedded FAT, and not part of the data file itself.
				size: file.diskSize + (file.attributes.compressed ? 4 : 0),
			});
			buffer.seekRel(file.name.length + 1);
		}

		return {
			main: buffer.getU8(),
		};
	}

	static isCompressed(filename) {
		// Files of these extensions are compressed.
		const compressedExtensions = [
			'MAT',
			'MDI',
			'PC1',
		];

		// These files are not compressed, even though they have a filename
		// extension that should be compressed.
		const uncompressedFiles = [
			'CHARSET1.MAT',
		];

		const fn = filename.toUpperCase();
		const ext = getExtension(fn);

		return compressedExtensions.includes(ext)
			&& !uncompressedFiles.includes(fn);
	}
}
