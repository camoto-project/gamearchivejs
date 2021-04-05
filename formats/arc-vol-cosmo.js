/*
 * Cosmo .VOL format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/VOL_Format
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

const FORMAT_ID = 'arc-vol-cosmo';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension, getExtension } from '../util/supp.js';

const recordTypes = {
	fatEntry: {
		name: RecordType.string.fixed.optTerm(12),
		offset: RecordType.int.u32le,
		size: RecordType.int.u32le,
	},
};

const FATENTRY_LEN = 20; // sizeof(fatEntry)
const MAX_FILES = 200;

export default class Archive_VOL_Cosmo extends ArchiveHandler
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

		md.caps.file.maxFilenameLen = 12;
		md.caps.maxFileCount = MAX_FILES;

		return md;
	}

	static supps(filename) {
		let ext = getExtension(filename);
		const extCheck = ext.toLowerCase();
		const validExt = ['vol', 'stn', 'cmp', 'ms1', 'ms2', 'ms3'];
		if (!validExt.find(e => e === extCheck)) {
			// Extension isn't one in the list, force it to a valid one.
			ext = 'vol';
		}
		return {
			main: replaceExtension(filename, ext),
		};
	}

	static identify(content) {
		const lenArchive = content.length;
		const lenFAT = MAX_FILES * FATENTRY_LEN;

		if (lenArchive < lenFAT) {
			return {
				valid: false,
				reason: `Archive too short to contain full FAT.`,
			};
		}
		let buffer = new RecordBuffer(content);

		for (let i = 0; i < MAX_FILES; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			// Ignore empty entries
			if (fatEntry.offset === 0) continue;

			if (fatEntry.offset < lenFAT) {
				return {
					valid: false,
					reason: `File ${i} @ offset ${fatEntry.offset} starts inside the `
						+ `FAT which ends at offset ${lenFAT}.`,
				};
			}
			if (fatEntry.offset + fatEntry.size > lenArchive) {
				return {
					valid: false,
					reason: `File ${i} ends beyond the end of the archive.`,
				};
			}
		}

		return {
			valid: true,
			reason: `All files contained within the archive.`,
		};
	}

	static parse({main: content}) {
		let archive = new Archive();
		let buffer = new RecordBuffer(content);

		for (let i = 0; i < MAX_FILES; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			if (fatEntry.offset !== 0) {
				let file = new File();
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
		for (const file of archive.files) {
			const entry = {
				name: file.name,
				offset: offset,
				size: file.nativeSize,
			};
			buffer.writeRecord(recordTypes.fatEntry, entry);
			offset += file.nativeSize;
		}

		// Write out the remaining empty FAT entries
		const lenPadFAT = (200 - archive.files.length) * FATENTRY_LEN;
		buffer.put(new Uint8Array(lenPadFAT));

		// Write the file data.
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
