/*
 * Indianapolis 500 archive format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://moddingwiki.shikadi.net/wiki/Indy_500_Library_Format
 *
 * Copyright (C) 2018-2021 Adam Nielsen <malvineous@shikadi.net>
 * Copyright (C) 2021 Colin Bourassa
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

const FORMAT_ID = 'arc-dat-indy500';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { cmp_lzss } from '@camoto/gamecomp';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension } from '../util/supp.js';

const cmpParams = {
	bitstream: false,
	invertFlag: true,
	lengthHigh: false,
	littleEndian: false,
	minDistance: 0,
	minLength: 3,
	prefillByte: 0x20,
	relativeDistance: false,
	rotateDistance: 8,
	sizeDistance: 12,
	sizeLength: 4,
	windowStartAt0: false,
};

export default class Archive_Indy500 extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Indy 500 Library File',
			games: [
				'Indianapolis 500: The Simulation',
			],
			glob: [
				'indy.1',
				'indy.2',
			],
		};

		// Although some files are compressed, the user cannot control which ones
		// so the attribute is unavailable.  Individual files still report whether
		// they are compressed or not in their attribute, it just cannot be changed.
		md.caps.file.attributes.compressed = false;

		md.caps.file.maxFilenameLen = 0;

		return md;
	}

	static supps(filename) {
		// The one game using this archive format (Indianapolis 500) only has two examples
		// of this archive, and they are named with the file extensions .1 and .2, respectively.
		// Simply use the .1 extension here.
		return {
			main: replaceExtension(filename, '1'),
		};
	}

	static identify(content) {

		if (content.length < 4) {
			return {
				valid: false,
				reason: `Archive size is less than minimum possible size.`,
			};
		}

		let buffer = new RecordBuffer(content);
		const fatSize = buffer.read(RecordType.int.u32le);

		if (fatSize % 4 !== 0) {
			return {
				valid: false,
				reason: `Header size not on 4-byte boundary.`,
			};
		}

		// The last FAT entry actually points to EOF, so subtract one for the count.
		const fileCount = (fatSize >> 2) - 1;

		// If the first FAT entry indicates that its data starts at offset 4,
		// this implies a file count of 0, which means that the total length
		// of the archive must be exactly 4 (comprising a single FAT entry.)
		if ((fileCount === 0) && (content.length !== 4)) {
			return {
				valid: false,
				reason: `Archive too long for file count of 0.`,
			};
		}

		if (content.length < fatSize) {
			return {
				valid: false,
				reason: `Content too short for file count.`,
			};
		}

		// The size of the header is also the file offset at which the
		// first contained file is stored.
		let startOffsets = [fatSize];

		// Read each offset and length and ensure it is valid.
		for (let i = 1; i < fileCount; i++) {

			startOffsets[i] = buffer.read(RecordType.int.u32le);

			if ((startOffsets[i] + 4) >= content.length) {
				return {
					valid: false,
					reason: `File ${i} @ offset ${startOffsets[i]} starts at or beyond `
						+ `the end of the archive.`,
				};
			}
		}

		let finalOffset;
		if (fileCount === 0) {
			finalOffset = fatSize;
		} else {
			finalOffset = buffer.read(RecordType.int.u32le);
		}

		if (finalOffset !== content.length) {
			return {
				valid: false,
				reason: `Final file offset ${finalOffset} does not match archive file `
					+ `size ${content.length}.`,
			};
		}

		return {
			valid: true,
			reason: `All file offsets are within the bounds of the archive file size.`,
		};
	}

	static parse({main: content}) {
		let archive = new Archive();
		let buffer = new RecordBuffer(content);
		const fatSize = buffer.read(RecordType.int.u32le);
		const fileCount = (fatSize >> 2) - 1;

		// The first file's data starts immediately after the FAT
		let startOffsets = [fatSize];

		// Collect all the start offset data. Since we've already read
		// the first word of the FAT, start with the second file.
		for (let i = 1; i < fileCount; i++) {
			startOffsets[i] = buffer.read(RecordType.int.u32le);
		}

		for (let i = 0; i < fileCount; i++) {
			buffer.seekAbs(startOffsets[i]);

			let file = new File();
			file.nativeSize = buffer.read(RecordType.int.u32le);
			file.offset = startOffsets[i] + 4;
			file.attributes.compressed = true;
			file.attributes.encrypted = false;

			// if we're at the last file entry, the calculation for the disk size is slightly different
			if (i < (fileCount - 1)) {
				file.diskSize = startOffsets[i + 1] - file.offset;
			} else {
				file.diskSize = content.length - file.offset;
			}

			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.getContent = () => cmp_lzss.reveal(file.getRaw(), cmpParams);

			archive.setOriginalFile(file);
			archive.files.push(file);
		}

		return archive;
	}

	static generate(archive) {
		const fileCount = archive.files.length;

		// Work out where the FAT ends and the first file starts.
		// There is one final FAT entry that points to EOF, so add 17 here.
		const offEndFAT = (fileCount + 1) * 4;

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const guessFinalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			offEndFAT,
		);

		let buffer = new RecordBuffer(guessFinalSize);

		// Seek to the end of the FAT so that the file content can be written
		// next; this allows us to determine the in-archive size of the files
		// as they are compressed.
		buffer.seekAbs(offEndFAT);

		let nextOffset = offEndFAT;

		let fileOffsets = [];

		for (let i = 0; i < archive.files.length; i++) {
			const file = archive.files[i];

			// Write the next offset in the FAT.
			buffer.seekAbs(i * 4);
			buffer.write(RecordType.int.u32le, nextOffset);
			buffer.seekAbs(nextOffset);

			// Save the offset of this file so that the FAT can be written later
			fileOffsets[i] = buffer.pos;

			let diskData;

			if (archive.isFileModified(file)) {
				// Content has been replaced, (or it's unchanged but the compression
				// attribute was changed), so compress it.

				// Load the content, which may decompress the source file.
				const nativeData = file.getContent();

				// Safety check.
				if (nativeData.length != file.nativeSize) {
					throw new Error(`Length of data (${nativeData.length}) and nativeSize `
						+ `(${file.nativeSize}) field do not match for ${file.name}!`);
				}

				// Compress the file.
				diskData = cmp_lzss.obscure(nativeData, cmpParams);

			} else {
				// The content for this file hasn't been replaced, so for performance
				// reasons, avoid decompressing and then recompressing it, and just use
				// the original data as-is.
				diskData = file.getRaw();
			}

			file.diskSize = diskData.length;

			// each file's data is prefixed with a 32-bit word containing its native size
			buffer.write(RecordType.int.u32le, file.nativeSize);
			buffer.put(diskData);

			nextOffset += diskData.length + 4;
		}

		// The original game archives have one final FAT entry that points to EOF.
		const eofOffset = (fileCount === 0) ? 4 : buffer.length;
		buffer.seekAbs(fileCount * 4);
		buffer.write(RecordType.int.u32le, eofOffset);

		return {
			main: buffer.getU8(),
		};
	}
}
