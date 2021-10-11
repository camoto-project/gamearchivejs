/*
 * Hocus Pocus .DAT format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/DAT_Format_%28Hocus_Pocus%29
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

const FORMAT_ID = 'arc-dat-hocus';

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
		size: RecordType.int.u32le,
	},
};

const FATENTRY_LEN = 8; // sizeof(fatEntry)

export default class Archive_DAT_Hocus extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Hocus Pocus Data File',
			games: [
				'Hocus Pocus',
			],
			glob: [
				'*.dat',
			],
		};

		md.caps.file.maxFilenameLen = 0; // no filenames

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'dat'),
			fat: replaceExtension(filename, 'fat'),
		};
	}

	static identify() {
		return {
			valid: undefined,
			reason: `Unable to autodetect this format.`,
		};
	}

	static parse(content) {
		let archive = new Archive();
		let fat = new RecordBuffer(content.fat);
		let buffer = new RecordBuffer(content.main);

		const fileCount = fat.length / FATENTRY_LEN;
		for (let i = 0; i < fileCount; i++) {
			const fatEntry = fat.readRecord(recordTypes.fatEntry);

			let file = new File();
			file.name = null;
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
		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			0,
		);

		let fat = new RecordBuffer(archive.files.length * FATENTRY_LEN);
		let buffer = new RecordBuffer(finalSize);

		let offset = 0;
		for (const file of archive.files) {
			const entry = {
				offset: offset,
				size: file.nativeSize,
			};
			fat.writeRecord(recordTypes.fatEntry, entry);
			offset += file.nativeSize;

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
			fat: fat.getU8(),
		};
	}
}
