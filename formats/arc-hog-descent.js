/**
 * @file Descent .HOG format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/HOG_Format
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

const FORMAT_ID = 'arc-hog-descent';

const recordTypes = {
	header: {
		signature: RecordType.string.fixed.noTerm(3),
	},
	fatEntry: {
		name: RecordType.string.fixed.reqTerm(13),
		diskSize: RecordType.int.u32le,
	},
};

const HEADER_LEN = 3; // sizeof(header)
const FATENTRY_LEN = 17; // sizeof(fatEntry)

module.exports = class Archive_GRP_Build extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Descent HOG File',
			games: [
				'Descent',
			],
			glob: [
				'*.hog',
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
			if (sig === 'DHF') return true;

			Debug.log(`Wrong signature => false`);
			return false;

		} finally {
			Debug.pop();
		}
	}

	static parse({main: content}) {
		let archive = new Archive();
		let buffer = new RecordBuffer(content);
		const lenArchive = content.length;

		let offset = HEADER_LEN;
		while (offset < lenArchive) {
			buffer.seekAbs(offset);
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);
			offset += FATENTRY_LEN;

			let file = new Archive.File();
			file.name = fatEntry.name;
			file.diskSize = file.nativeSize = fatEntry.diskSize;
			file.offset = offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);

			archive.files.push(file);

			offset += fatEntry.diskSize;
		}

		return archive;
	}

	static generate(archive)
	{
		const header = {
			signature: 'DHF',
		};

		// Calculate the size up front (if all the diskSize fields are available)
		// so we don't have to keep reallocating the buffer, improving performance.
		const guessFinalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			HEADER_LEN + archive.files.length * FATENTRY_LEN,
		);

		let buffer = new RecordBuffer(guessFinalSize);
		buffer.writeRecord(recordTypes.header, header);

		archive.files.forEach(file => {
			const content = file.getContent();
			file.diskSize = file.nativeSize = content.length;
			buffer.writeRecord(recordTypes.fatEntry, file);
			buffer.put(content);
		});

		return {
			main: buffer.getU8(),
		};
	}
};
