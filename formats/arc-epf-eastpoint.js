/*
 * East Point Software .EPF format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/EPF_Format
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

const FORMAT_ID = 'arc-epf-eastpoint';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { cmp_lzw } from '@camoto/gamecomp';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension } from '../util/supp.js';
import { getLUID } from '../util/uuid.js';

const recordTypes = {
	header: {
		signature: RecordType.string.fixed.noTerm(4),
		offFAT: RecordType.int.u32le,
		unknown: RecordType.int.u8,
		fileCount: RecordType.int.u16le,
	},
	fatEntry: {
		name: RecordType.string.fixed.reqTerm(13),
		flags: RecordType.int.u8,
		diskSize: RecordType.int.u32le,
		nativeSize: RecordType.int.u32le,
	},
};

const HEADER_LEN = 11; // sizeof(header)
const FATENTRY_LEN = 22; // sizeof(fatEntry)

// File flags.
const EPFF_COMPRESSED = 0x01;

const cmpParams = {
	initialBits: 9,
	maxBits: 14,
	cwEOF: -1,    // max codeword
	cwDictReset: -2, // max-1
	cwFirst: 256,
	bigEndian: true,
	flushOnReset: false,
};

export default class Archive_EPF_EastPoint extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'East Point File Storage',
			games: [
				'Alien Breed Tower Assault',
				'Arcade Pool',
				'Asterix & Obelix',
				'Jungle Book, The',
				'Lion King, The',
				'Overdrive',
				'Project X',
				'Sensible Golf',
				'Smurfs, The',
				'Spirou',
				'Tin Tin in Tibet',
				'Universe',
			],
			glob: [
				'*.epf',
			],
		};

		// Attributes that can be changed per-file.
		md.caps.file.attributes.compressed = true;

		md.caps.file.maxFilenameLen = 12;

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'epf'),
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

		const sig = recordTypes.header.signature.read(buffer);
		if (sig !== 'EPFS') {
			return {
				valid: false,
				reason: `Wrong signature.`,
			};
		}

		return {
			valid: true,
			reason: `Signature matched.`,
		};
	}

	static parse({main: content}) {
		let archive = new Archive();
		// Allocate and save a unique ID for this archive instance.
		archive.luid = getLUID();

		let buffer = new RecordBuffer(content);

		const header = buffer.readRecord(recordTypes.header);

		buffer.seekAbs(header.offFAT);
		let offset = HEADER_LEN;
		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			let file = new File();
			file.name = fatEntry.name;
			file.diskSize = fatEntry.diskSize;
			file.nativeSize = fatEntry.nativeSize;
			file.offset = offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);

			if (fatEntry.flags & EPFF_COMPRESSED) {
				file.attributes.compressed = true;
				file.getContent = () => cmp_lzw.reveal(file.getRaw(), cmpParams);
			} else {
				file.attributes.compressed = false;
			}

			// Mark this file's content as unique to this archive, so that if the
			// content is later changed, we can recognise that fact.
			file.getContent.luid = archive.luid;

			archive.files.push(file);
			offset += fatEntry.diskSize;
		}

		return archive;
	}

	static generate(archive)
	{
		// Work out where the FAT ends and the first file starts.
		const lenFAT = FATENTRY_LEN * archive.files.length;

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.  We assume no compression on any files.
		const guessFinalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			HEADER_LEN + lenFAT,
		);

		let buffer = new RecordBuffer(guessFinalSize);

		// Skip over header, we'll write it last.
		buffer.seekAbs(HEADER_LEN);

		for (const file of archive.files) {
			let content;
			if (
				(archive.luid !== undefined)
				&& (file.getContent.luid === archive.luid)
			) {
				// The content for this file hasn't been replaced, so for performance
				// reasons, avoid decompressing and then recompressing it, and just use
				// the original data as-is.
				content = file.getRaw();

			} else {
				// Content has been replaced, compress it.

				// Load the content, which may decompress the source file.
				content = file.getContent();

				// Safety check.
				if (content.length != file.nativeSize) {
					throw new Error(`Length of data (${content.length}) and nativeSize `
						+ `(${file.nativeSize}) field do not match for ${file.name}!`);
				}

				// Compress if attribute is either on or "don't care".
				const isCompressed = file.attributes.compressed !== false;
				if (isCompressed) {
					content = cmp_lzw.obscure(content, cmpParams);
				}
			}
			file.diskSize = content.length;
			buffer.put(content);
		}

		const offFAT = buffer.getPos();

		for (const file of archive.files) {
			// Compress if attribute is either on or "don't care".
			const isCompressed = file.attributes.compressed !== false;

			const entry = {
				flags: isCompressed ? EPFF_COMPRESSED : 0,
				diskSize: file.diskSize,
				nativeSize: file.nativeSize,
				name: file.name,
			};
			buffer.writeRecord(recordTypes.fatEntry, entry);
		}

		// Go back and write the header now we know where the FAT starts.
		const header = {
			signature: 'EPFS',
			offFAT: offFAT,
			unknown: 0,
			fileCount: archive.files.length,
		};
		buffer.seekAbs(0);
		buffer.writeRecord(recordTypes.header, header);

		return {
			main: buffer.getU8(),
		};
	}
}
