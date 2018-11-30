/**
 * @file Cosmo .VOL format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/VOL_Format
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

const FORMAT_ID = 'arc-vol-cosmo';

const recordTypes = {
	fatEntry: {
		name: RecordType.string.fixed.optTerm(12),
		offset: RecordType.int.u32le,
		size: RecordType.int.u32le,
	},
};

const FATENTRY_LEN = 20; // sizeof(fatEntry)
const MAX_FILES = 200;

module.exports = class Archive_VOL_Cosmo extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Cosmo Data Volume',
			games: [
				'Cosmo\'s Cosmic Adventures',
				'Duke Nukem II',
				'Major Stryker',
			],
			glob: [
				'*.vol',
				'*.stn',
				'*.cmp',
				'*.ms1',
				'*.ms2',
				'*.ms3',
			],
		};

		md.limits.maxFilenameLen = 12;
		md.limits.maxFileCount = MAX_FILES;

		return md;
	}

	static identify(content) {
		try {
			Debug.push(FORMAT_ID, 'identify');

			const lenArchive = content.length;
			const lenFAT = MAX_FILES * FATENTRY_LEN;

			if (lenArchive < lenFAT) {
				Debug.log(`Archive too short to contain full FAT => false`);
				return false;
			}
			let buffer = new RecordBuffer(content);

			for (let i = 0; i < MAX_FILES; i++) {
				const fatEntry = buffer.readRecord(recordTypes.fatEntry);

				// Ignore empty entries
				if (fatEntry.offset === 0) continue;

				if (fatEntry.offset < lenFAT) {
					Debug.log(`File ${i} @ offset ${fatEntry.offset} starts inside the `
						+ `FAT which ends at offset ${lenFAT} => false`);
					return false;
				}
				if (fatEntry.offset > lenArchive) {
					Debug.log(`File ${i} starts beyond the end of the archive => false`);
					return false;
				}
				if (fatEntry.offset + fatEntry.size > lenArchive) {
					Debug.log(`File ${i} ends beyond the end of the archive => false`);
					return false;
				}
			}
			Debug.log(`All files contained within the archive => true`);
			return true;

		} finally {
			Debug.pop();
		}
	}

	static parse({main: content}) {
		let archive = new Archive();
		let buffer = new RecordBuffer(content);

		for (let i = 0; i < MAX_FILES; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			if (fatEntry.offset !== 0) {
				let file = new Archive.File();
				file.name = fatEntry.name;
				file.diskSize = file.nativeSize = fatEntry.size;
				file.offset = fatEntry.offset;
				file.getRaw = () => buffer.getU8(file.offset, file.diskSize);

				archive.files.push(file);
			}
		}

		return archive;
	}

	static generate(archive)
	{
		const lenFAT = MAX_FILES * FATENTRY_LEN;

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			lenFAT,
		);

		let buffer = new RecordBuffer(finalSize);

		let offset = lenFAT;
		archive.files.forEach(file => {
			const entry = {
				name: file.name,
				offset: offset,
				size: file.nativeSize,
			};
			buffer.writeRecord(recordTypes.fatEntry, entry);
			offset += file.nativeSize;
		});

		// Write out the remaining empty FAT entries
		const lenPadFAT = (200 - archive.files.length) * FATENTRY_LEN;
		buffer.put(new Uint8Array(lenPadFAT));

		// Write the file data.
		archive.files.forEach(file => {
			const content = file.getContent();

			// Safety check.
			if (content.length != file.nativeSize) {
				throw new Error('Length of data and nativeSize field do not match!');
			}

			buffer.put(content);
		});

		return {
			main: buffer.getU8(),
		};
	}
};
