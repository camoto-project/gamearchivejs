/*
 * Doofus .G-D file reader/writer.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/Doofus_Game_Data_Format
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

const FORMAT_ID = 'arc-gd-doofus';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension, getExtension } from '../util/supp.js';

const recordTypes = {
	fatEntry: {
		size: RecordType.int.u16le,
		type: RecordType.int.u16le,
		padding: RecordType.int.u32le,
	},
};

const FATENTRY_LEN = 8; // sizeof(fatEntry)

export default class Archive_GD_Doofus extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Doofus Game Data',
			games: [
				'Doofus',
			],
			glob: [
				'*.g-d',
			],
		};

		md.caps.file.maxFilenameLen = 12;

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'g-d'),
			fat: replaceExtension(filename, 'fat'),
		};
	}

	static identify() {
		return {
			valid: undefined,
			reason: `Unable to autodetect this format.`,
		};
	}

	static parse({main: content, fat: fatContent}) {
		if (!fatContent) {
			throw new Error('Missing FAT supplementary item.');
		}

		let buffer = new RecordBuffer(content);
		let fat = new RecordBuffer(fatContent);

		let archive = new Archive();

		const fileCount = fat.length / FATENTRY_LEN;
		let offset = 0;
		for (let i = 0; i < fileCount; i++) {
			const fatEntry = fat.readRecord(recordTypes.fatEntry);

			if (fatEntry.size === 0) {
				// No more files
				break;
			}

			let ext = fatEntry.type.toString(16);
			let c;
			switch (fatEntry.type) {
				case 0x0000: ext = 'bin'; c = 0; break;
				case 0x1636: ext = 'tls'; c = 1; break;
				case 0x2376: ext = 'ovl'; c = 1; break;
				case 0x3276: ext = 'mbg'; c = 1; break;
				case 0x3F64: ext = 'fin'; c = 1; break;
				case 0x43EE: ext = 'end'; c = 1; break;
				case 0x48BE: ext = 'sto'; c = 1; break;
				case 0x3F2E: ext = 'dat'; c = 1; break;
				case 0x59EE: ext = 'bsa'; c = 0; break;
			}
			let file = new File();
			file.name = `file${i}.${ext}`;
			file.diskSize = file.nativeSize = fatEntry.size;
			file.offset = offset;
			file.attributes.compressed = !!c;
			file.attributes.encrypted = false;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			archive.files.push(file);

			offset += fatEntry.size;
		}

		return archive;
	}

	static generate(archive)
	{
		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			archive.files.length * FATENTRY_LEN,
		);

		let fat = new RecordBuffer(FATENTRY_LEN * 65);
		let buffer = new RecordBuffer(finalSize);

		const typeMap = {
			bin: 0x0000,
			tls: 0x1636,
			ovl: 0x2376,
			mbg: 0x3276,
			dat: 0x3F2E,
			bsa: 0x59EE,
			end: 0x43EE,
			sto: 0x48BE,
		};

		for (const file of archive.files) {
			const content = file.getContent();

			// Safety check.
			if (content.length != file.nativeSize) {
				throw new Error(`Length of data (${content.length}) and nativeSize `
					+ `(${file.nativeSize}) field do not match for ${file.name}!`);
			}

			fat.writeRecord(recordTypes.fatEntry, {
				size: file.nativeSize,
				type: typeMap[getExtension(file.name)] || 0x0000,
				padding: 0,
			});
			buffer.put(content);
		}

		return {
			main: buffer.getU8(),
			fat: fat.getU8(),
		};
	}
}
