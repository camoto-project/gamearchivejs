/**
 * @file Wacky Wheels .DAT format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/DAT_Format_%28Wacky_Wheels%29
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

const FORMAT_ID = 'arc-dat-wacky';

const { RecordBuffer, RecordType } = require('@malvineous/record-io-buffer');

const ArchiveHandler = require('./archiveHandler.js');
const Archive = require('./archive.js');
const Debug = require('../util/utl-debug.js');
const g_debug = Debug.extend(FORMAT_ID);

const recordTypes = {
	header: {
		fileCount: RecordType.int.u16le,
	},
	fatEntry: {
		name: RecordType.string.fixed.optTerm(12),
		pad: RecordType.padding(2),
		size: RecordType.int.u32le,
		offset: RecordType.int.u32le,
	},
};

const HEADER_LEN = 2; // sizeof(header)
const FATENTRY_LEN = 22; // sizeof(fatEntry)

module.exports = class Archive_GRP_Build extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Wacky Wheels Data File',
			games: [
				'Wacky Wheels',
			],
			glob: [
				'*.dat',
			],
		};

		md.caps.file.maxFilenameLen = 12;

		return md;
	}

	static identify(content) {
		const debug = g_debug.extend('identify');
		const lenArchive = content.length;

		if (lenArchive < HEADER_LEN) {
			return {
				valid: false,
				reason: `Content too short (< ${HEADER_LEN} b).`,
			};
		}

		let buffer = new RecordBuffer(content);
		const header = buffer.readRecord(recordTypes.header);

		const lenFAT = HEADER_LEN + header.fileCount * FATENTRY_LEN;

		if (content.length < lenFAT) {
			return {
				valid: false,
				reason: `FAT truncated (file length ${content.length} < FAT length ${lenFAT}).`,
			};
		}

		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			if (fatEntry.offset + HEADER_LEN < lenFAT) {
				return {
					valid: false,
					reason: `File ${i} @ offset ${fatEntry.offset} starts inside the FAT `
						+ `which ends at offset ${lenFAT}.`,
				};
			}
			if (fatEntry.offset + HEADER_LEN > lenArchive) {
				return {
					valid: false,
					reason: `File ${i} starts beyond the end of the archive.`,
				};
			}
			if (fatEntry.offset + HEADER_LEN + fatEntry.size > lenArchive) {
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

		const header = buffer.readRecord(recordTypes.header);

		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			let file = new Archive.File();
			file.name = fatEntry.name;
			file.diskSize = file.nativeSize = fatEntry.size;
			file.offset = fatEntry.offset + HEADER_LEN;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);

			archive.files.push(file);
		}

		return archive;
	}

	static generate(archive)
	{
		const header = {
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

		let offset = lenFAT - HEADER_LEN;
		archive.files.forEach(file => {
			const entry = {
				name: file.name,
				size: file.nativeSize,
				offset: offset,
			};
			buffer.writeRecord(recordTypes.fatEntry, entry);
			offset += file.nativeSize;
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
};
