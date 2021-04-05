/*
 * Descent .HOG format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/HOG_Format
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

const FORMAT_ID = 'arc-hog-descent';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension } from '../util/supp.js';

const recordTypes = {
	header: {
		signature: RecordType.string.fixed.noTerm(3),
	},
	fatEntry: {
		name: RecordType.string.fixed.reqTerm(13),
		size: RecordType.int.u32le,
	},
};

const HEADER_LEN = 3; // sizeof(header)
const FATENTRY_LEN = 17; // sizeof(fatEntry)

export default class Archive_GRP_Build extends ArchiveHandler
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

		md.caps.file.maxFilenameLen = 12;

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'hog'),
		};
	}

	static identify(content) {
		if (content.length < HEADER_LEN) {
			return {
				valid: false,
				reason: `Content too short (< ${HEADER_LEN} b).`,
			};
		}

		let buffer = new RecordBuffer(content);

		const sig = recordTypes.header.signature.read(buffer);
		if (sig !== 'DHF') {
			return {
				valid: false,
				reason: `Wrong signature.`,
			};
		}

		return {
			valid: true,
			reason: `Signature matched.`,
		};
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

			let file = new File();
			file.name = fatEntry.name;
			file.diskSize = file.nativeSize = fatEntry.size;
			file.offset = offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);

			archive.files.push(file);

			offset += fatEntry.size;
		}

		return archive;
	}

	static generate(archive)
	{
		const header = {
			signature: 'DHF',
		};

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			HEADER_LEN + archive.files.length * FATENTRY_LEN,
		);

		let buffer = new RecordBuffer(finalSize);
		buffer.writeRecord(recordTypes.header, header);

		for (const file of archive.files) {
			const content = file.getContent();

			// Safety check.
			if (content.length != file.nativeSize) {
				throw new Error(`Length of data (${content.length}) and nativeSize `
					+ `(${file.nativeSize}) field do not match for ${file.name}!`);
			}
			const entry = {
				name: file.name,
				size: file.nativeSize,
			};

			buffer.writeRecord(recordTypes.fatEntry, entry);
			buffer.put(content);
		}

		return {
			main: buffer.getU8(),
		};
	}
}
