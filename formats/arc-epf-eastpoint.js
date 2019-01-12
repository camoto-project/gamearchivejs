/**
 * @file East Point Software .EPF format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/EPF_Format
 *
 * Copyright (C) 2018-2019 Adam Nielsen <malvineous@shikadi.net>
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

const { RecordBuffer, RecordType } = require('@malvineous/record-io-buffer');
const GameCompression = require('@malvineous/gamecomp');

const ArchiveHandler = require('./archiveHandler.js');
const Archive = require('./archive.js');
const Debug = require('../util/utl-debug.js');

const FORMAT_ID = 'arc-epf-eastpoint';

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

module.exports = class Archive_EPF_EastPoint extends ArchiveHandler
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

		md.limits.maxFilenameLen = 12;

		return md;
	}

	static identify(content) {
		try {
			Debug.push(FORMAT_ID, 'identify');

			if (content.length < HEADER_LEN) {
				Debug.log(`Content too short (< ${HEADER_LEN} b) => false`);
				return false;
			}

			let buffer = new RecordBuffer(content);

			const sig = recordTypes.header.signature.read(buffer);
			if (sig !== 'EPFS') {
				Debug.log(`Wrong signature => false`);
				return false;
			}

			Debug.log(`Signature matched => true`);
			return true;

		} finally {
			Debug.pop();
		}
	}

	static parse({main: content}) {
		const comp = GameCompression.getHandler('cmp-lzw');
		let archive = new Archive();
		let buffer = new RecordBuffer(content);

		const header = buffer.readRecord(recordTypes.header);

		buffer.seekAbs(header.offFAT);
		let offset = HEADER_LEN;
		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			let file = new Archive.File();
			file.name = fatEntry.name;
			file.diskSize = fatEntry.diskSize;
			file.nativeSize = fatEntry.nativeSize;
			file.offset = offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);

			if (fatEntry.flags & EPFF_COMPRESSED) {
				file.attributes.compressed = true;
				file.getContent = () => comp.reveal(file.getRaw(), cmpParams);
			} else {
				file.attributes.compressed = false;
			}

			archive.files.push(file);
			offset += fatEntry.diskSize;
		}

		return archive;
	}

	static generate(archive)
	{
		const comp = GameCompression.getHandler('cmp-lzw');

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

		archive.files.forEach(file => {
			// Compress if attribute is either on or "don't care".
			const isCompressed = file.attributes.compressed !== false;

			let content = file.getContent();

			// Safety check.
			if (content.length != file.nativeSize) {
				throw new Error('Length of data and nativeSize field do not match!');
			}

			if (isCompressed) {
				content = comp.obscure(content, cmpParams);
			}
			file.diskSize = content.length;
			buffer.put(content);
		});

		const offFAT = buffer.getPos();

		archive.files.forEach(file => {
			// Compress if attribute is either on or "don't care".
			const isCompressed = file.attributes.compressed !== false;

			const entry = {
				flags: isCompressed ? EPFF_COMPRESSED : 0,
				diskSize: file.diskSize,
				nativeSize: file.nativeSize,
				name: file.name,
			};
			buffer.writeRecord(recordTypes.fatEntry, entry);
		});

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
};
