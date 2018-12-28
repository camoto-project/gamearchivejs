/**
 * @file Halloween Harry .BNK format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/BNK_Format_%28Halloween_Harry%29
 *
 * Copyright (C) 2018 Adam Nielsen <malvineous@shikadi.net>
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

const { RecordBuffer, RecordType } = require('@malvineous/record-io-buffer');

const ArchiveHandler = require('./archiveHandler.js');
const Archive = require('./archive.js');
const Debug = require('../util/utl-debug.js');
const Supp = require('./supp.js');

const FORMAT_ID = 'arc-bnk-harry';

const recordTypes = {
	fileHeader: {
		lenSig: RecordType.int.u8,
		signature: RecordType.string.fixed.noTerm(4),
		lenName: RecordType.int.u8,
		name: RecordType.string.fixed.noTerm(12),
		diskSize: RecordType.int.u32le,
	},
	fatEntry: {
		lenName: RecordType.int.u8,
		name: RecordType.string.fixed.noTerm(12),
		offset: RecordType.int.u32le,
		diskSize: RecordType.int.u32le,
	},
};

const FILEHEADER_LEN = 22; // sizeof(fileHeader)
const FATENTRY_LEN = 21; // sizeof(fatEntry)

module.exports = class Archive_BNK_Harry extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Halloween Harry Data Bank',
			games: [
				'Halloween Harry',
			],
			glob: [
				'*.bnk',
				'*.-0',
			],
		};

		md.limits.maxFilenameLen = 12;

		return md;
	}

	static supps(name) {
		return {
			fat: Supp.replaceExtension(name, 'fat'),
		};
	}

	static identify(content) {
		try {
			Debug.push(FORMAT_ID, 'identify');

			const lenArchive = content.length;
			// Empty archive
			if (lenArchive === 0) return true;

			if (lenArchive < FILEHEADER_LEN) {
				Debug.log(`File length ${lenArchive} too short, min ${FILEHEADER_LEN} => false`);
				return false;
			}

			let buffer = new RecordBuffer(content);

			const file1 = buffer.readRecord(recordTypes.fileHeader);
			if (file1.signature !== '-ID-') {
				Debug.log(`Wrong signature ${file1.signature} => false`);
				return false;
			}

			// Read the second file signature too, as this will tell us whether it's
			// Halloween Harry or Alien Carnage.
			buffer.seekRel(file1.diskSize);
			const file2 = buffer.readRecord(recordTypes.fileHeader);
			if (file2.signature !== '-ID-') {
				Debug.log(`Wrong signature for second file ${file2.signature} => false`);
				return false;
			}

			Debug.log(`Signature matched => true`);
			return true;

		} finally {
			Debug.pop();
		}
	}

	static parse(content) {
		if (!content.fat) {
			throw new Error('BUG: Caller forgot to include supplementary file.');
		}
		let archive = new Archive();

		const lenFAT = content.fat.length;
		let fileCount = lenFAT / FATENTRY_LEN;

		let buffer = new RecordBuffer(content.main);
		let bufferFAT = new RecordBuffer(content.fat);

		for (let i = 0; i < fileCount; i++) {
			const fatEntry = bufferFAT.readRecord(recordTypes.fatEntry);

			let file = new Archive.File();
			// Crop filename down to indicated length (Pascal-style string)
			file.name = fatEntry.name.substr(0, fatEntry.lenName);
			file.diskSize = file.nativeSize = fatEntry.diskSize;
			file.offset = fatEntry.offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);

			archive.files.push(file);
		}

		return archive;
	}

	static generate(archive)
	{
		const fileCount = archive.files.length;
		const lenFAT = fileCount * FATENTRY_LEN;

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			fileCount * FILEHEADER_LEN,
		);

		let buffer = new RecordBuffer(finalSize);
		let bufferFAT = new RecordBuffer(lenFAT);

		let nextOffset = FILEHEADER_LEN;

		archive.files.forEach(file => {
			const fatEntry = {
				lenName: file.name.length,
				name: file.name,
				offset: nextOffset,
				diskSize: file.nativeSize,
			};

			const fileHeader = {
				...fatEntry,
				lenSig: 4,
				signature: '-ID-',
			};

			buffer.writeRecord(recordTypes.fileHeader, fileHeader);

			const nativeData = file.getContent();

			// Safety check.
			if (nativeData.length != file.nativeSize) {
				throw new Error('Length of data and nativeSize field do not match!');
			}

			// @todo Handle compression/decompression
			buffer.put(nativeData, fatEntry.diskSize);

			// Add an entry to the external FAT.
			bufferFAT.writeRecord(recordTypes.fatEntry, fatEntry);

			nextOffset += fatEntry.diskSize + FILEHEADER_LEN;
		});

		return {
			main: buffer.getU8(),
			fat: bufferFAT.getU8(),
		};
	}
};
