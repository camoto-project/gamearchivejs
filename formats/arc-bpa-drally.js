/*
 * Death Rally .BPA format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/Death_Rally_BPA_Format
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

const FORMAT_ID = 'arc-bpa-drally';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { enc_bpa_drally_filename } from '@camoto/gamecomp';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension } from '../util/supp.js';

const HEADER_LEN = 4 + 255 * (13 + 4);   // sizeof(header) + FAT
const FATENTRY_LEN = 13 + 4; // sizeof(fatEntry)

export default class Archive_BPA_DeathRally extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Death Rally BPA File',
			games: [
				'Death Rally',
			],
			glob: [
				'*.bpa',
			],
		};

		md.caps.file.maxFilenameLen = 12;

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'bpa'),
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

		let totalSize = HEADER_LEN;
		const fileCount = buffer.read(RecordType.int.u32le);
		if (fileCount > 255) {
			return {
				valid: false,
				reason: `Too many files (${fileCount} > max 255).`,
			};
		}

		for (let i = 0; i < fileCount; i++) {
			buffer.seekRel(13); // skip filename
			const size = buffer.read(RecordType.int.u32le);
			totalSize += size;
			if (totalSize > buffer.length) {
				return {
					valid: false,
					reason: `File ${i} ends beyond the end of the archive.`,
				};
			}
		}

		if (totalSize != buffer.length) {
			return {
				valid: false,
				reason: `${buffer.length - totalSize} byte(s) of trailing data at EOF.`,
			};
		}

		return {
			valid: true,
			reason: `All checks passed.`,
		};
	}

	static parse({main: content}) {
		let archive = new Archive();

		let buffer = new RecordBuffer(content);
		const fileCount = buffer.read(RecordType.int.u32le);

		let lastOffset = HEADER_LEN;
		for (let i = 0; i < fileCount; i++) {
			// Have to read the filename manually as if we read it as a string it
			// gets converted from CP437 to UTF-8 which prevents proper decryption.
			const filename = buffer.get(13);
			const decFilename = enc_bpa_drally_filename.reveal(
				filename.slice(0, filename.indexOf(0))
			);

			const size = buffer.read(RecordType.int.u32le);

			let file = new File();
			file.name = RecordType.string.fromArray(decFilename);
			file.diskSize = file.nativeSize = size;
			file.offset = lastOffset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);

			archive.files.push(file);

			lastOffset += file.diskSize;
		}

		return archive;
	}

	static generate(archive)
	{
		// Work out where the FAT ends and the first file starts.
		const offEndFAT = HEADER_LEN;

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			offEndFAT,
		);

		let buffer = new RecordBuffer(finalSize);
		buffer.write(RecordType.int.u32le, archive.files.length);

		for (const file of archive.files) {
			const nameBuf = RecordType.string.toU8(file.name);
			buffer.put(enc_bpa_drally_filename.obscure(nameBuf));
			if (nameBuf.length < 13) {
				// Pad out to 13 chars.
				buffer.write(RecordType.padding(13 - nameBuf.length));
			}
			buffer.write(RecordType.int.u32le, file.nativeSize);
		}

		// Pad out to 255 entries.
		const blankEntries = 255 - archive.files.length;
		buffer.write(RecordType.padding(blankEntries * FATENTRY_LEN));

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
