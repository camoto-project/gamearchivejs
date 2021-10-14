/*
 * Gateworld .gw[123] format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/HomeBrew_File_Folder_Format
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

const FORMAT_ID = 'arc-gw-homebrew';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension } from '../util/supp.js';

const recordTypes = {
	header: {
		signature: RecordType.string.fixed.optTerm(20),
		signature2: RecordType.int.u8,
		pad: RecordType.padding(11),
		version: RecordType.int.u16le,
		fileCount: RecordType.int.u32le,
		pad2: RecordType.padding(26),
	},
	fatEntry: {
		name: RecordType.string.fixed.optTerm(12),
		pad: RecordType.padding(4),
		offset: RecordType.int.u32le,
		size: RecordType.int.u32le,
		pad2: RecordType.padding(8),
	},
};

const HEADER_LEN = 64; // sizeof(header)
const FATENTRY_LEN = 32; // sizeof(fatEntry)

export default class Archive_GW_HomeBrew extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'HomeBrew File Folder',
			games: [
				'Gateworld',
			],
			glob: [
				'*.gw1',
				'*.gw2',
				'*.gw3',
			],
		};

		md.caps.file.maxFilenameLen = 12;

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'gw1'),
		};
	}

	static identify(content) {
		const lenArchive = content.length;

		if (lenArchive < HEADER_LEN) {
			return {
				valid: false,
				reason: `Content too short (< ${HEADER_LEN} b).`,
			};
		}

		let buffer = new RecordBuffer(content);
		const header = buffer.readRecord(recordTypes.header);

		if (header.signature !== 'HomeBrew File Folder') {
			return {
				valid: false,
				reason: `Wrong signature.`,
			};
		}

		if (header.version !== 0x100) {
			return {
				valid: false,
				reason: `Unknown version.`,
			};
		}

		return {
			valid: true,
			reason: `Valid signature.`,
		};
	}

	static parse({main: content}) {
		let archive = new Archive();
		let buffer = new RecordBuffer(content);

		const header = buffer.readRecord(recordTypes.header);

		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			let file = new File();
			file.name = fatEntry.name;
			file.diskSize = file.nativeSize = fatEntry.size;
			file.offset = fatEntry.offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.attributes.compressed = false;
			file.attributes.encrypted = false;

			archive.files.push(file);
		}

		return archive;
	}

	static generate(archive)
	{
		const header = {
			signature: 'HomeBrew File Folder',
			signature2: 0x1A,
			version: 0x100,
			fileCount: archive.files.length,
		};

		// Work out where the FAT ends and the first file starts.
		const lenFAT = HEADER_LEN + FATENTRY_LEN * header.fileCount;

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			lenFAT,
		);

		let buffer = new RecordBuffer(finalSize);
		buffer.writeRecord(recordTypes.header, header);

		let offset = lenFAT;
		for (const file of archive.files) {
			const entry = {
				name: file.name,
				offset: offset,
				size: file.nativeSize,
			};
			buffer.writeRecord(recordTypes.fatEntry, entry);
			offset += file.nativeSize;
		}

		for (const file of archive.files) {
			const content = file.getContent();

			// Safety check.
			if (content.length != file.nativeSize) {
				throw new Error(`Length of data (${content.length}) and nativeSize `
					+ `(${file.nativeSize}) field do not match for ${file.name}!`);
			}

			buffer.put(content);
		}

		return {
			main: buffer.getU8(),
		};
	}
}
