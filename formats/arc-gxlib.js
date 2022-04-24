/*
 * GX Library format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/GX_Library
 *
 * Copyright (C) 2010-2022 Adam Nielsen <malvineous@shikadi.net>
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

const FORMAT_ID = 'arc-gxlib';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { getBasename, getExtension, replaceExtension } from '../util/supp.js';
import { fromFAT16Time, toFAT16Time } from '../util/datetime.js';

const recordTypes = {
	header: {
		id: RecordType.int.u16le,
		copyright: RecordType.string.fixed.optTerm(50),
		version: RecordType.int.u16le,
		label: RecordType.string.fixed.optTerm(40),
		fileCount: RecordType.int.u16le,
		padding: RecordType.block(32, 0),
	},
	fatEntry: {
		pack: RecordType.int.u8,
		name: RecordType.string.fixed.reqTerm(13),
		offset: RecordType.int.u32le,
		size: RecordType.int.u32le,
		date: RecordType.int.u16le,
		time: RecordType.int.u16le,
	},
};

const HEADER_LEN = 2 + 50 + 2 + 40 + 2 + 32; // sizeof(header)
const FATENTRY_LEN = 1 + 13 + 4 + 4 + 2 + 2; // sizeof(fatEntry)
const TAG_DEFAULT_COPYRIGHT = 'Copyright (c) Genus Microprogramming, Inc. 1988-90';

export default class Archive_PCX_Library extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'GX Library',
			games: [
				'Oregon Trail, The',
				'Word Rescue',
			],
			glob: [
				'*.gxl',
			],
		};

		// This format can save the last-modified time of files.
		md.caps.file.lastModified = true;

		md.caps.file.maxFilenameLen = 12;

		md.caps.tags = {
			copyright: {
				type: 'string',
				size: 50,
			},
			label: {
				type: 'string',
				size: 40,
			},
		};

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'gxl'),
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
		let header = buffer.readRecord(recordTypes.header);

		if (header.id !== 0xCA01) {
			return {
				valid: false,
				reason: `Wrong signature.`,
			};
		}
		if (header.version !== 100) {
			return {
				valid: false,
				reason: `Unsupported version.`,
			};
		}

		return {
			valid: true,
			reason: `Signature matched, version OK.`,
		};
	}

	static parse({main: content}) {
		let archive = new Archive();

		let buffer = new RecordBuffer(content);
		let header = buffer.readRecord(recordTypes.header);

		archive.tags.copyright = header.copyright;
		archive.tags.label = header.label;

		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			const ext = fatEntry.name.substr(9).trim();
			const fext = ext.length ? '.' + ext : '';

			let file = new File();
			file.name = fatEntry.name.substr(0, 8).trim() + fext;
			file.diskSize = file.nativeSize = fatEntry.size;
			file.offset = fatEntry.offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.lastModified = fromFAT16Time(fatEntry.date, fatEntry.time);
			file.attributes.compressed = false;
			file.attributes.encrypted = false;

			archive.files.push(file);
		}

		return archive;
	}

	static generate(archive)
	{
		const header = {
			id: 0xCA01,
			copyright: archive.tags.copyright || TAG_DEFAULT_COPYRIGHT,
			version: 100,
			label: archive.tags.label || '',
			fileCount: archive.files.length,
			padding: '',
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

		const now = toFAT16Time(new Date());

		let nextOffset = offEndFAT;
		for (const file of archive.files) {
			const basename = getBasename(file.name).padEnd(8, ' ');
			const extension = getExtension(file.name).padEnd(3, ' ');
			let lastModified = now;
			if (file.lastModified) {
				lastModified = toFAT16Time(file.lastModified);
			}

			const entry = {
				pack: 0,
				name: basename + '.' + extension,
				offset: nextOffset,
				size: file.nativeSize,
				...lastModified,
			};
			nextOffset += entry.size;
			buffer.writeRecord(recordTypes.fatEntry, entry);
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
