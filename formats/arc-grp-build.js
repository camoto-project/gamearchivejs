/*
 * BUILD engine .GRP format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/GRP_Format
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

const FORMAT_ID = 'arc-grp-build';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';

const recordTypes = {
	header: {
		signature: RecordType.string.fixed.noTerm(12),
		fileCount: RecordType.int.u32le,
	},
	fatEntry: {
		name: RecordType.string.fixed.optTerm(12),
		size: RecordType.int.u32le,
	},
};

const FATENTRY_LEN = 16; // sizeof(fatEntry)

export default class Archive_GRP_Build extends ArchiveHandler
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

		md.caps.file.maxFilenameLen = 12;

		return md;
	}

	static identify(content) {
		if (content.length < FATENTRY_LEN) {
			return {
				valid: false,
				reason: `Content too short (< ${FATENTRY_LEN} b).`,
			};
		}

		let buffer = new RecordBuffer(content);

		const sig = recordTypes.header.signature.read(buffer);
		if (sig !== 'KenSilverman') {
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
		const lenArchive = content.length;

		let buffer = new RecordBuffer(content);
		let header = buffer.readRecord(recordTypes.header);

		let nextOffset = FATENTRY_LEN * (header.fileCount + 1);
		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);
			let offset = nextOffset; // copy inside closure for f.get()

			let file = new File();
			file.name = fatEntry.name;
			file.diskSize = file.nativeSize = fatEntry.size;
			file.offset = offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);

			archive.files.push(file);

			nextOffset += fatEntry.size;
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

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			offEndFAT,
		);

		let buffer = new RecordBuffer(finalSize);
		buffer.writeRecord(recordTypes.header, header);

		archive.files.forEach(file => {
			const entry = {
				name: file.name,
				size: file.nativeSize,
			};
			buffer.writeRecord(recordTypes.fatEntry, entry);
		});

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
}
