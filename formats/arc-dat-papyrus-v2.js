/*
 * Papyrus V2 .DAT format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/DAT_Format_(Papyrus)
 *
 * Copyright (C) 2018-2021 Adam Nielsen <malvineous@shikadi.net>
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

const FORMAT_ID = 'arc-dat-papyrus-v2';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import {
	RecordBuffer,
	RecordType
} from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';

const recordTypes = {
	header: {
		fileCount: RecordType.int.u16le,
	},
	fatEntry: {
		flags: RecordType.int.u16le,
		nativeSize: RecordType.int.u32le,
		diskSize: RecordType.int.u32le,
		name: RecordType.string.fixed.optTerm(13),
		offset: RecordType.int.u32le,
	},
};

const HEADER_LEN = 2; // sizeof(header)
const FATENTRY_LEN = 27; // sizeof(fatEntry)
const DEFAULT_FLAGS = 0x0005;

export default class Archive_DAT_PapyrusV2 extends ArchiveHandler {
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Papyrus v2 DAT File',
			games: [
				'IndyCar Racing',
				'NASCAR Racing',
				'IndyCar Racing II',
				'NASCAR Racing 2',
				'Grand Prix Legends',
				'NASCAR Racing 2',
				'NASCAR Racing 3',
			],
			glob: [
				'*.dat',
			],
		};

		md.caps.file.maxFilenameLen = 13;

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
				reason: `Content too short for file count.`,
			};
		}

		// Read each offset and length and ensure it is valid.
		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			if (fatEntry.flags != DEFAULT_FLAGS) {
				return {
					valid: false,
					reason: `File ${i} @ offset ${fatEntry.offset} does not use the only valid flags for this format.`,
				};
			}
			if (fatEntry.offset >= content.length) {
				return {
					valid: false,
					reason: `File ${i} @ offset ${fatEntry.offset} starts beyond the end of the archive.`,
				};
			}
			if (fatEntry.offset + fatEntry.diskSize > content.length) {
				return {
					valid: false,
					reason: `File ${i} ends beyond the end of the archive.`,
				};
			}
			if (fatEntry.diskSize != fatEntry.nativeSize) {
				return {
					valid: false,
					reason: `File ${i} lists a different diskSize and nativeSize, despite compression being unsupported.`,
				};
			}
		}

		return {
			valid: true,
			reason: `All file offsets/lengths are within the bounds of the archive file size.`,
		};
	}

	static parse({
		main: content
	}) {
		let archive = new Archive();
		let buffer = new RecordBuffer(content);

		const header = buffer.readRecord(recordTypes.header);
		archive.tags.description = header.description;

		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			let file = new File();
			file.name = fatEntry.name;
			file.diskSize = fatEntry.diskSize;
			file.nativeSize = fatEntry.nativeSize;
			file.offset = fatEntry.offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);

			archive.files.push(file);
		}

		return archive;
	}

	static generate(archive) {
		const header = {
			fileCount: archive.files.length,
		};

		// Work out where the FAT ends and the first file starts.
		const offEndFAT = HEADER_LEN + FATENTRY_LEN * header.fileCount;

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const guessFinalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			offEndFAT,
		);

		let buffer = new RecordBuffer(guessFinalSize);

		// write out the two-byte file count header
		buffer.writeRecord(recordTypes.header, header);

		// seek to the end of the FAT so that the file content can be written
		buffer.seekAbs(offEndFAT);

		archive.files.forEach(file => {

			let content = file.getContent();

			// Safety check.
			if (content.length != file.nativeSize) {
				throw new Error('Length of data and nativeSize field do not match!');
			}

			file.diskSize = content.length;

			buffer.put(content);
		});

		// now, go back and write the FAT
		buffer.seekAbs(HEADER_LEN);
		let nextOffset = offEndFAT;

		archive.files.forEach(file => {

			const entry = {
				flags: DEFAULT_FLAGS,
				nativeSize: file.nativeSize,
				diskSize: file.nativeSize,
				name: file.name,
				offset: nextOffset,
			};
			nextOffset += entry.diskSize;

			buffer.writeRecord(recordTypes.fatEntry, entry);
		});

		return {
			main: buffer.getU8(),
		};
	}
}
