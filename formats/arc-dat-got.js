/*
 * God of Thunder .DAT format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   https://moddingwiki.shikadi.net/wiki/DAT_Format_(God_of_Thunder)
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

const FORMAT_ID = 'arc-dat-got';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { cmp_lzss, enc_xor_incremental } from '@camoto/gamecomp';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension } from '../util/supp.js';

const recordTypes = {
	fatEntry: {
		name: RecordType.string.fixed.reqTerm(9),
		offset: RecordType.int.u32le,
		diskSize: RecordType.int.u32le,
		nativeSize: RecordType.int.u32le,
		flags: RecordType.int.u16le,
	},
};

const FATENTRY_LEN = 23; // sizeof(fatEntry)
const FILE_COUNT = 256; // fixed number of files
const FAT_LEN = FILE_COUNT * FATENTRY_LEN; // fixed-length FAT

// cmp_lzss parameters to compress/decompress files.
const cmpParams = {
	bitstream: false,
	invertFlag: true,
	lengthHigh: true,
	littleEndian: true,
	minDistance: 0,
	minLength: 2,
	prefillByte: 0x00,
	relativeDistance: true,
	rotateDistance: 0,
	sizeDistance: 12,
	sizeLength: 4,
	windowStartAt0: true,
};

const encParams = {
	seed: 0x80,
	limit: 0,
	step: 1,
};

export default class Archive_DAT_GoT extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'God of Thunder Data File',
			games: [
				'God of Thunder',
			],
			glob: [
				'*.dat',
			],
		};

		// The user can control which files are and aren't compressed.
		md.caps.file.attributes.compressed = true;

		md.caps.file.maxFilenameLen = 8;

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
		const lenArchive = content.length;

		if (lenArchive < FAT_LEN) {
			return {
				valid: false,
				reason: `Not enough space for FAT.`,
			};
		}

		const decryptedFAT = enc_xor_incremental.reveal(
			content.slice(0, FAT_LEN),
			encParams
		);
		let buffer = new RecordBuffer(decryptedFAT);

		let lastEnd = 0;
		for (let i = 0; i < FILE_COUNT; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			// Skip empty files (used to pad out FAT up to size).
			if ((fatEntry.diskSize === 0) && (fatEntry.offset === 0)) continue;

			if (lastEnd === 0) {
				// This is the first file.
				if (fatEntry.offset != FAT_LEN) {
					return {
						valid: false,
						reason: `First file does not immediately follow FAT (offset `
							+ `${fatEntry.offset} is not ${FAT_LEN}).`,
					};
				}
			}

			const nextEnd = fatEntry.offset + fatEntry.diskSize;
			if (nextEnd > lenArchive) {
				return {
					valid: false,
					reason: `File ${i} extends beyond the end of the archive.`,
				};
			}
			lastEnd = Math.max(lastEnd, nextEnd);
		}

		if ((lastEnd === 0) && (lenArchive === FAT_LEN)) {
			return {
				valid: true,
				reason: `Empty archive.`,
			};
		}

		if (lastEnd != lenArchive) {
			return {
				valid: false,
				reason: `Last file finishes at offset ${lastEnd} which is not the end `
					+ `of the archive at ${lenArchive}.`,
			};
		}

		return {
			valid: true,
			reason: `All FAT entries are valid.`,
		};
	}

	static parse({main: content}) {
		let archive = new Archive();
		const decryptedFAT = enc_xor_incremental.reveal(
			content.slice(0, FAT_LEN),
			encParams
		);
		let fat = new RecordBuffer(decryptedFAT);
		let buffer = new RecordBuffer(content);

		for (let i = 0; i < FILE_COUNT; i++) {
			const fatEntry = fat.readRecord(recordTypes.fatEntry);

			// Skip empty files (used to pad out FAT up to size).
			if ((fatEntry.diskSize === 0) && (fatEntry.offset === 0)) continue;

			let file = new File();
			file.name = fatEntry.name;
			file.diskSize = fatEntry.diskSize;
			file.nativeSize = fatEntry.nativeSize;
			file.offset = fatEntry.offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.attributes.compressed = !!(fatEntry.flags & 0x0001);

			if (file.attributes.compressed) {
				file.offset += 4; // skip 2*uint16le header
				file.diskSize -= 4;
				file.getContent = () => (
					cmp_lzss
						.reveal(file.getRaw(), cmpParams)
						// The decompressor has trailing bytes so chop it down to the
						// length in the header.
						.slice(0, file.nativeSize)
				);
			}
			archive.setOriginalFile(file);
			archive.files.push(file);
		}

		return archive;
	}

	static generate(archive)
	{
		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			FAT_LEN,
		);

		let buffer = new RecordBuffer(finalSize);

		// Skip over FAT, we'll fill it in as we go.
		let nextOffset = FAT_LEN;

		for (let i = 0; i < archive.files.length; i++) {
			const file = archive.files[i];

			buffer.seekAbs(nextOffset);

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

			let lenEmbeddedHeader = 0;

			file.diskSize = diskData.length;
			if (file.attributes.compressed) {
				// Write the decompressed size at the start of the file data.
				buffer.write(RecordType.int.u16le, file.nativeSize);
				// Plus some unknown value.
				buffer.write(RecordType.int.u16le, 0x0001);
				lenEmbeddedHeader = 4;
			}

			buffer.put(diskData);

			// Write the file details in the FAT.
			buffer.seekAbs(i * FATENTRY_LEN);
			buffer.writeRecord(recordTypes.fatEntry, {
				name: file.name,
				offset: nextOffset,
				diskSize: file.diskSize + lenEmbeddedHeader,
				nativeSize: file.nativeSize,
				flags: file.attributes.compressed ? 0x0001 : 0x0000,
			});

			nextOffset += diskData.length + lenEmbeddedHeader;
		}

		// Encrypt the FAT.
		const encryptedFAT = enc_xor_incremental.obscure(
			buffer.getU8(0, FAT_LEN),
			encParams
		);
		buffer.seekAbs(0);
		buffer.put(encryptedFAT);
		return {
			main: buffer.getU8(),
		};
	}
}
