/**
 * @brief BUILD engine .GRP format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/GRP_Format
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

const FORMAT_ID = 'arc-grp-build';

const recordTypes = {
	header: {
		signature: RecordType.string.fixed.withNulls(12),
		fileCount: RecordType.int.u32le,
	},
	fatEntry: {
		name: RecordType.string.fixed.optNullTerm(12),
		diskSize: RecordType.int.u32le,
	},
};

const FATENTRY_LEN = 16; // sizeof(fatEntry)

module.exports = class Archive_GRP_Build extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'BUILD Group File',
			games: [
				'Duke Nukem 3D',
				'Redneck Rampage',
				'Shadow Warrior',
			],
			glob: [
				'*.grp',
			],
		};

		md.limits.maxFilenameLen = 12;

		return md;
	}

	static identify(content) {
		try {
			Debug.push(FORMAT_ID, 'identify');

			let buffer = new RecordBuffer(content);

			const sig = recordTypes.header.signature.read(buffer);
			if (sig === 'KenSilverman') return true;
			Debug.log(`Wrong signature => false`);
			return false;

		} finally {
			Debug.pop();
		}
	}

	static parse(content) {
		let archive = new Archive();
		const lenArchive = content.length;

		let buffer = new RecordBuffer(content);
		let header = buffer.readRecord(recordTypes.header);

		let nextOffset = FATENTRY_LEN * (header.fileCount + 1);
		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);
			let offset = nextOffset; // copy inside closure for f.get()

			let file = new Archive.File();
			file.name = fatEntry.name;
			file.diskSize = file.nativeSize = fatEntry.diskSize;
			file.offset = offset;
			file.getRaw = () => buffer.sliceBlock(offset, file.diskSize);

			archive.files.push(file);

			nextOffset += fatEntry.diskSize;
			if (nextOffset > lenArchive) {
				console.error('Archive truncated, returning partial content');
				break;
			}
		}

		return archive;
	}

	static generate(archive)
	{
		const header = {
			signature: 'KenSilverman',
			fileCount: archive.files.length,
		};

		// Work out where the FAT ends and the first file starts.
		const offEndFAT = FATENTRY_LEN * (header.fileCount + 1);

		// Calculate the size up front (if all the diskSize fields are available)
		// so we don't have to keep reallocating the buffer, improving performance.
		const guessFinalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			offEndFAT,
		);

		let buffer = new RecordBuffer(guessFinalSize);
		buffer.writeRecord(recordTypes.header, header);

		// Write the files first so we can retrieve the sizes.
		buffer.seekAbs(offEndFAT);

		archive.files.forEach(file => {
			const content = file.getContent();
			file.diskSize = file.nativeSize = content.length;
			buffer.put(content);
		});

		buffer.seekAbs(FATENTRY_LEN * 1);

		archive.files.forEach(file => {
			buffer.writeRecord(recordTypes.fatEntry, file);
		});

		return buffer.getBuffer();
	}
};
