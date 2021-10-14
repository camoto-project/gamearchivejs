/*
 * Stargunner .DLT format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/DLT_Format
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

const FORMAT_ID = 'arc-dlt-stargunner';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import {
	cmp_bpe_stargunner,
	enc_dlt_stargunner_filename,
} from '@camoto/gamecomp';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension } from '../util/supp.js';

const recordTypes = {
	header: {
		signature: RecordType.string.fixed.optTerm(4),
		version: RecordType.int.u16le,
		fileCount: RecordType.int.u16le,
	},
	fatEntry: {
		name: RecordType.block(32),
		lastModified: RecordType.int.u32le,
		size: RecordType.int.u32le,
	},
};

const HEADER_LEN = 8; // sizeof(header)
const FATENTRY_LEN = 40; // sizeof(fatEntry)

const msdosEpoch = 315532800; // 1980-01-01 UTC

export default class Archive_DLT_Stargunner extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Stargunner DLT Archive',
			games: [
				'Stargunner',
			],
			glob: [
				'*.dlt',
			],
		};

		// This format can save the last-modified time of files.
		md.caps.file.lastModified = true;

		md.caps.file.maxFilenameLen = 32;

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'dlt'),
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

		if (header.signature !== 'DAVE') {
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

		const tzOffset = new Date().getTimezoneOffset() * 60;

		const header = buffer.readRecord(recordTypes.header);

		let offset = HEADER_LEN;
		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);
			offset += FATENTRY_LEN;

			// Decrypt filename.
			let decFilename = enc_dlt_stargunner_filename.reveal(fatEntry.name);
			const end = decFilename.indexOf(0);
			if (end >= 0) {
				decFilename = decFilename.slice(0, end);
			}

			let file = new File();
			file.name = RecordType.string.fromArray(decFilename);
			file.diskSize = file.nativeSize = fatEntry.size;
			file.offset = offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.attributes.compressed = false;
			file.attributes.encrypted = false;

			const fileSig = buffer.read(RecordType.string.fixed.noTerm(4));
			if (fileSig === 'PGBP') {
				file.attributes.compressed = true;
				file.nativeSize = buffer.read(RecordType.int.u32le);
				file.getContent = () => (
					cmp_bpe_stargunner.reveal(file.getRaw())
				);
			}

			// The file's last-modified time is in local time, but when we create
			// a date object from a UNIX timestamp it's assumed to be in UTC.  So
			// we have to add the local timezone onto it to keep it as local time.
			const unixTimeUTC = msdosEpoch + fatEntry.lastModified + tzOffset;
			file.lastModified = new Date(unixTimeUTC * 1000);

			archive.setOriginalFile(file);
			archive.files.push(file);

			offset += fatEntry.size;
			buffer.seekAbs(offset);
		}

		return archive;
	}

	static generate(archive)
	{
		// Since the archive does not store a timezone, we assume, like DOS, that
		// the times are local time on the current PC.
		// Since Date.now() returns time since UTC 1970, we need to add the local
		// timezone onto that so that to convert it into seconds since 1970 local
		// time.
		const tzOffset = new Date().getTimezoneOffset() * 60;
		let now = Math.round(Date.now() / 1000) - tzOffset;

		const header = {
			signature: 'DAVE',
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

		for (const file of archive.files) {
			let diskData;
			if (archive.isFileModified(file)) {
				// Content has been replaced, (or it's unchanged but the compression
				// attribute was changed), so compress it.

				// Load the content, which may decompress the source file.
				let fileContent = file.getContent();

				// Safety check.
				if (fileContent.length != file.nativeSize) {
					throw new Error(`Length of data (${fileContent.length}) and nativeSize `
						+ `(${file.nativeSize}) field do not match for file ${file.name}!`);
				}

				if (file.attributes.compressed) {
					diskData = cmp_bpe_stargunner.obscure(fileContent);
				} else {
					diskData = fileContent;
				}

			} else {
				// The content for this file hasn't been replaced, so for performance
				// reasons, avoid decompressing and then recompressing it, and just use
				// the original data as-is.
				diskData = file.getRaw();
			}

			file.diskSize = diskData.length;

			// Encrypt filename.
			let nameBuffer = new RecordBuffer(32);
			nameBuffer.write(RecordType.string.fixed.noTerm(32), file.name);
			const encryptedName = enc_dlt_stargunner_filename.obscure(nameBuffer.getU8());

			let entry = {
				name: encryptedName,
				lastModified: now,
				size: file.diskSize,
			};
			// Use an existing last-modified date if there is one.
			if (file.lastModified) {
				// Again we have to include the current timezone so that we are writing
				// local time rather than UTC to the file.
				entry.lastModified = file.lastModified.valueOf() / 1000 - tzOffset - msdosEpoch;
			}

			buffer.writeRecord(recordTypes.fatEntry, entry);
			buffer.put(diskData);
		}

		return {
			main: buffer.getU8(),
		};
	}
}
