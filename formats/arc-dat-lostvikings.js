/*
 * Descent .HOG format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   https://moddingwiki.shikadi.net/wiki/DAT_Format_(The_Lost_Vikings)
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

const FORMAT_ID = 'arc-dat-lostvikings';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { cmp_lzss } from '@camoto/gamecomp';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension } from '../util/supp.js';

const uncompressedFiles = [
	0,
	1,
	380,
	384,
	529,
	530,
	531,
	534,
];

// cmp_lzss parameters to compress/decompress files.
const cmpParams = {
	bitstream: false,
	invertFlag: true,
	lengthHigh: true,
	littleEndian: true,
	minDistance: 0,
	minLength: 3,
	prefillByte: 0x00,
	relativeDistance: false,
	rotateDistance: 0,
	sizeDistance: 12,
	sizeLength: 4,
	windowStartAt0: true,
};

export default class Archive_DAT_LostVikings extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Lost Vikings Data File',
			games: [
				'BlackThorne',
				'The Lost Vikings',
				'WarCraft: Orcs & Humans',
			],
			glob: [
				'*.dat',
			],
		};

		// Although the files are compressed, individual files can't be stored
		// uncompressed, so the 'compression' attribute is unavailable.
		md.caps.file.attributes.compressed = undefined;

		md.caps.file.maxFilenameLen = 0;

		return md;
	}

	static checkLimits(archive)
	{
		let issues = super.checkLimits(archive);

		for (let i = 0; i < archive.files.length; i++) {
			const file = archive.files[i];

			if (file.nativeSize >= 0xFFFF) {
				issues.push(`File ${i} is ${file.nativeSize} bytes in size, but this `
					+ `archive format has a maximum size of 65535 bytes.`);
			}
		}

		return issues;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'dat'),
		};
	}

	static identify(content) {
		let buffer = new RecordBuffer(content);
		const lenArchive = content.length;

		if (lenArchive === 0) {
			return {
				valid: true,
				reason: `Empty archive.`,
			};
		}

		if (lenArchive < 4) {
			return {
				valid: true,
				reason: `Not enough space for FAT.`,
			};
		}

		const firstOffset = buffer.read(RecordType.int.u32le);
		if (firstOffset >= lenArchive) {
			return {
				valid: false,
				reason: `FAT ends at or past EOF.`,
			};
		}

		if (firstOffset % 4 !== 0) {
			return {
				valid: false,
				reason: `FAT is not divisible by 4.`,
			};
		}

		const fileCount = (firstOffset >> 2) - 1;
		let lastOffset = firstOffset;
		for (let i = 0; i < fileCount; i++) {
			const nextOffset = buffer.read(RecordType.int.u32le);
			if (nextOffset >= lenArchive) {
				return {
					valid: false,
					reason: `File ${i} @ offset ${nextOffset} starts at or beyond the `
						+ `end of the archive.`,
				};
			}
			if (nextOffset < lastOffset) {
				return {
					valid: false,
					reason: `File ${i} @ offset ${nextOffset} is before the preceding `
						+ `file at offset ${lastOffset} (negative file size).`,
				};
			}
			lastOffset = nextOffset;
		}

		return {
			valid: true,
			reason: `All FAT offsets match.`,
		};
	}

	static parse({main: content}) {
		let archive = new Archive();
		let buffer = new RecordBuffer(content);
		const lenArchive = content.length;

		const firstOffset = buffer.read(RecordType.int.u32le);
		let lastOffset = firstOffset;
		const fileCount = (firstOffset >> 2);
		for (let i = 0; i < fileCount; i++) {
			let nextOffset;
			if (i === fileCount - 1) {
				nextOffset = lenArchive;
			} else {
				nextOffset = buffer.read(RecordType.int.u32le);
			}

			let file = new File();
			file.diskSize = file.nativeSize = nextOffset - lastOffset;
			file.offset = lastOffset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.attributes.compressed = !uncompressedFiles.includes(i);

			archive.setOriginalFile(file);
			archive.files.push(file);

			lastOffset = nextOffset;
		}

		// Read the decompressed-size from the start of each compressed file, and
		// set up the decompression code.
		for (let file of archive.files) {
			if (file.attributes.compressed) {
				buffer.seekAbs(file.offset);
				file.nativeSize = buffer.read(RecordType.int.u16le);
				file.offset += 2; // skip uint16le header we just read
				file.diskSize -= 2;
				file.getContent = () => (
					cmp_lzss
						.reveal(file.getRaw(), cmpParams)
						// The decompressor has trailing bytes so chop it down to the
						// length in the header.
						.slice(0, file.nativeSize)
				);
				archive.setOriginalFile(file);
			}
		}

		return archive;
	}

	static generate(archive)
	{
		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			archive.files.length * 6,
		);

		let buffer = new RecordBuffer(finalSize);

		// Skip over FAT, we'll fill it in as we go.
		let nextOffset = archive.files.length * 4;

		for (let i = 0; i < archive.files.length; i++) {
			const file = archive.files[i];

			// Write the next offset in the FAT.
			buffer.seekAbs(i * 4);
			buffer.write(RecordType.int.u32le, nextOffset);
			buffer.seekAbs(nextOffset);

			file.attributes.compressed = !uncompressedFiles.includes(i);

			let diskData;
			if (archive.isFileModified(file)) {
				// Content has been replaced, (or it's unchanged but the compression
				// attribute was changed), so compress it.

				// Load the content, which may decompress the source file.
				let fileContent = file.getContent();

				// Safety check.
				if (fileContent.length != file.nativeSize) {
					throw new Error(`Length of data (${fileContent.length}) and nativeSize `
						+ `(${file.nativeSize}) field do not match for file @${i}!`);
				}

				if (file.attributes.compressed) {
					diskData = cmp_lzss.obscure(fileContent, cmpParams);
				} else {
					diskData = fileContent;
				}

			} else {
				// The content for this file hasn't been replaced, so for performance
				// reasons, avoid decompressing and then recompressing it, and just use
				// the original data as-is.
				diskData = file.getRaw();
			}

			file.diskSize = diskData.length;
			if (file.attributes.compressed) {
				// Write the decompressed size at the start of the file data.
				buffer.write(RecordType.int.u16le, file.nativeSize);
				nextOffset += 2;
			}

			buffer.put(diskData);
			nextOffset += diskData.length;
		}
		// Final offset isn't written, EOF is used instead.

		return {
			main: buffer.getU8(),
		};
	}
}
