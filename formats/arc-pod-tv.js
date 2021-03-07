/*
 * Terminal Velocity .POD format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/POD_Format
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

const FORMAT_ID = 'arc-pod-tv';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';

const recordTypes = {
	header: {
		fileCount: RecordType.int.u32le,
		description: RecordType.string.fixed.optTerm(80),
	},
	fatEntry: {
		name: RecordType.string.fixed.optTerm(32),
		size: RecordType.int.u32le,
		offset: RecordType.int.u32le,
	},
};

const HEADER_LEN = 84;   // sizeof(header)
const FATENTRY_LEN = 40; // sizeof(fatEntry)

export default class Archive_POD_TV extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Terminal Reality POD File',
			games: [
				'Terminal Velocity',
			],
			glob: [
				'*.pod',
			],
		};

		md.caps.file.maxFilenameLen = 32;

		md.caps.tags = {
			description: {
				type: 'string',
				size: 80,
			},
		};

		return md;
	}

	static identify(content) {
		if (content.length < HEADER_LEN) {
			return {
				valid: false,
				reason: `Content too short (< ${HEADER_LEN} b).`,
			};
		}

		let buffer = new RecordBuffer(content);

		const header = buffer.readRecord(recordTypes.header);
		const offEndFAT = HEADER_LEN + header.fileCount * FATENTRY_LEN;
		if (content.length < offEndFAT) {
			return {
				valid: false,
				reason: `Content too short for file count (< ${offEndFAT} b).`,
			};
		}

		// Read each offset and length and ensure it is valid.
		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);
			if (fatEntry.offset < offEndFAT) {
				return {
					valid: false,
					reason: `File ${i} starts inside the FAT.`,
				};
			}
			if (fatEntry.offset + fatEntry.size > content.length) {
				return {
					valid: false,
					reason: `File ${i} ends beyond the end of the archive.`,
				};
			}
		}

		return {
			valid: true,
			reason: `All checks passed.`,
		};
	}

	static parse({main: content}) {
		let archive = new Archive();

		let buffer = new RecordBuffer(content);
		let header = buffer.readRecord(recordTypes.header);
		archive.tags.description = header.description;

		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			let file = new File();
			file.name = fatEntry.name;
			file.diskSize = file.nativeSize = fatEntry.size;
			file.offset = fatEntry.offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);

			archive.files.push(file);
		}

		return archive;
	}

	static generate(archive)
	{
		const header = {
			fileCount: archive.files.length,
			description: archive.tags.description || 'Unnamed POD file',
		};

		// Work out where the FAT ends and the first file starts.
		const offEndFAT = HEADER_LEN + FATENTRY_LEN * header.fileCount;

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			offEndFAT,
		);

		let buffer = new RecordBuffer(finalSize);
		buffer.writeRecord(recordTypes.header, header);

		let nextOffset = offEndFAT;
		for (const file of archive.files) {
			const entry = {
				name: file.name,
				offset: nextOffset,
				size: file.nativeSize,
			};
			nextOffset += entry.size;
			buffer.writeRecord(recordTypes.fatEntry, entry);
		}

		for (const file of archive.files) {
			const content = file.getContent();

			// Safety check.
			if (content.length != file.nativeSize) {
				throw new Error('Length of data and nativeSize field do not match!');
			}

			buffer.put(content);
		}

		return {
			main: buffer.getU8(),
		};
	}
}
