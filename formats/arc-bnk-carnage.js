/*
 * Alien Carnage .-0 format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/BNK_Format_%28Halloween_Harry%29
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

const FORMAT_ID = 'arc-bnk-carnage';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension } from '../util/supp.js';

const recordTypes = {
	fileHeader: {
		lenSig: RecordType.int.u8,
		signature: RecordType.string.fixed.noTerm(4),
		lenName: RecordType.int.u8,
		name: RecordType.string.fixed.noTerm(12),
		diskSize: RecordType.int.u32le,
		nativeSize: RecordType.int.u32le,
	},
};

const FILEHEADER_LEN = 26; // sizeof(fileHeader)

export default class Archive_BNK_Carnage extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Alien Carnage Data Bank',
			games: [
				'Alien Carnage',
			],
			glob: [
				'*.-0',
			],
		};

		md.caps.file.maxFilenameLen = 12;

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, '-0'),
		};
	}

	static identify(content) {
		const lenArchive = content.length;
		// Empty archive
		if (lenArchive === 0) {
			return {
				valid: true,
				reason: `Empty file.`,
			};
		}

		if (lenArchive < FILEHEADER_LEN) {
			return {
				valid: false,
				reason: `Content too short (< ${FILEHEADER_LEN} b).`,
			};
		}

		let buffer = new RecordBuffer(content);

		const file1 = buffer.readRecord(recordTypes.fileHeader);
		if (file1.signature !== '-ID-') {
			return {
				valid: false,
				reason: `Wrong signature "${file1.signature}".`,
			};
		}

		if (lenArchive < FILEHEADER_LEN + file1.diskSize) {
			return {
				valid: false,
				reason: `First file is truncated.`,
			};
		}

		if (lenArchive === FILEHEADER_LEN + file1.diskSize) {
			return {
				valid: true,
				reason: `Only one file.`,
			};
		}

		if (lenArchive < FILEHEADER_LEN*2 + file1.diskSize) {
			return {
				valid: false,
				reason: `Second file header truncated.`,
			};
		}


		// Read the second file signature too, as this will tell us whether it's
		// Halloween Harry or Alien Carnage.
		buffer.seekRel(file1.diskSize);
		const file2 = buffer.readRecord(recordTypes.fileHeader);
		if (file2.signature !== '-ID-') {
			return {
				valid: false,
				reason: `Wrong signature for second file "${file2.signature}".`,
			};
		}

		return {
			valid: true,
			reason: `Signature matched.`,
		};
	}

	static parse(content) {
		let buffer = new RecordBuffer(content.main);
		let archive = new Archive();

		let offset = 0;
		while (offset + FILEHEADER_LEN < buffer.length) {
			const fatEntry = buffer.readRecord(recordTypes.fileHeader);
			offset += FILEHEADER_LEN;

			let file = new File();
			// Crop filename down to indicated length (Pascal-style string)
			file.name = fatEntry.name.substr(0, fatEntry.lenName);
			file.diskSize = fatEntry.diskSize;
			file.nativeSize = fatEntry.nativeSize;
			file.offset = offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.getContent = () => {
				throw new Error('arc-bnk-carnage: Decompression currently unsupported.');
			};
			file.attributes.compressed = true;
			file.attributes.encrypted = false;

			archive.setOriginalFile(file);
			archive.files.push(file);

			buffer.seekRel(file.diskSize);
			offset += file.diskSize;
		}

		return archive;
	}

	static generate(archive)
	{
		const fileCount = archive.files.length;

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			fileCount * FILEHEADER_LEN,
		);

		let buffer = new RecordBuffer(finalSize);

		let nextOffset = 0;

		for (const file of archive.files) {
			let diskData;
			if (archive.isFileModified(file)) {
				// Content has been replaced, (or it's unchanged but the compression
				// attribute was changed), so compress it.

				// Load the content, which may decompress the source file.
				let fileContent = file.getContent();

				// Safety check.
				if (fileContent.length != file.nativeSize) {
					throw new Error(`Length of data (${fileContent.length}) and nativeSize `
						+ `(${file.nativeSize}) field do not match for file @${file.name}!`);
				}

				if (file.attributes.compressed) {
					// TODO: Compress
					throw new Error('arc-bnk-carnage: Decompression currently unsupported.');
					//diskData = cmp_pkware_dcl.obscure(fileContent, cmpParams);
				} else {
					diskData = fileContent;
				}

			} else {
				// The content for this file hasn't been replaced, so for performance
				// reasons, avoid decompressing and then recompressing it, and just use
				// the original data as-is.
				diskData = file.getRaw();
			}

			nextOffset += FILEHEADER_LEN;

			const fileHeader = {
				lenSig: 4,
				signature: '-ID-',
				lenName: file.name.length,
				name: file.name,
				offset: nextOffset,
				diskSize: file.diskSize,
				nativeSize: file.nativeSize,
			};

			buffer.writeRecord(recordTypes.fileHeader, fileHeader);
			buffer.put(diskData);

			nextOffset += file.diskSize;
		}

		return {
			main: buffer.getU8(),
		};
	}
}
