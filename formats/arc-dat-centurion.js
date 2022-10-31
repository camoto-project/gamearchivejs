/*
 * Centurion .DAT format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/DAT_Format_(Centurion - Defender of Rome)
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

const FORMAT_ID = 'arc-dat-centurion';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension } from '../util/supp.js';

const recordTypes = {
	fatEntry: {
		offset: RecordType.int.u32le,
		size: RecordType.int.u16le,
		name: RecordType.string.fixed.reqTerm(13),
		attributes: RecordType.int.u8,
	},
};

const FATENTRY_LEN = 4+2+13+1; // sizeof(fatEntry)

export default class Archive_DAT_Centurion extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Centurion Data File',
			games: [
				'Centurion',
			],
			glob: [
				'*.dat',
			],
		};

		// 32-bit offsets.
		md.caps.maxArchiveLen = Math.pow(2, 32) - 1;
		// 16-bit sizes.
		md.caps.file.maxFileSize = Math.pow(2, 16) - 1;

		// Files can optionally be compressed.
		md.caps.file.attributes.compressed = true;

		md.caps.file.maxFilenameLen = 12;

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'dat'),
			fat: replaceExtension(filename, 'dir'),
		};
	}

	static identify() {
		// TODO: Check .dir file for valid characters.
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
		for (let i = 0; i < fileCount; i++) {
			const fatEntry = fat.readRecord(recordTypes.fatEntry);

			let file = new File();
			file.name = fatEntry.name;
			file.diskSize = file.nativeSize = fatEntry.size;
			file.offset = fatEntry.offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.attributes.compressed = !!(fatEntry.attributes & 0x80);
			file.attributes.encrypted = false;

			archive.files.push(file);
		}

		return archive;
	}

	static generate(archive)
	{
		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			0,
		);

		let fat = new RecordBuffer(FATENTRY_LEN * 65);
		let buffer = new RecordBuffer(finalSize);

		let nextOffset = 0;

		for (const file of archive.files) {
			if (nextOffset > 65535) {
				throw new Error('Archive too large (max file offset is 64 kB)');
			}

			const entry = {
				size: file.nativeSize,
				offset: nextOffset,
				name: file.name,
				// TODO: include flag 0x40 for CBM files
				attributes: (file.attributes.compressed ? 0x80 : 0x00),
			};
			fat.writeRecord(recordTypes.fatEntry, entry);

			const content = file.getContent();

			// Safety check.
			if (content.length != file.nativeSize) {
				throw new Error(`Length of data (${content.length}) and nativeSize `
					+ `(${file.nativeSize}) field do not match for ${file.name}!`);
			}

			buffer.put(content);

			nextOffset += content.length;
		}

		return {
			main: buffer.getU8(),
			fat: fat.getU8(),
		};
	}
}
