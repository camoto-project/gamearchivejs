/**
 * @file Raptor .GLB format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/GLB_Format
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

const { RecordBuffer, RecordType } = require('@malvineous/record-io-buffer');
const GameCompression = require('@malvineous/gamecomp');

const ArchiveHandler = require('./archiveHandler.js');
const Archive = require('./archive.js');
const Debug = require('../util/utl-debug.js');

const FORMAT_ID = 'arc-glb-raptor';

const recordTypes = {
	header: {
		signature: RecordType.int.u32le,
		fileCount: RecordType.int.u32le,
		pad: RecordType.padding(20),
	},
	fatEntry: {
		flags: RecordType.int.u32le,
		offset: RecordType.int.u32le,
		size: RecordType.int.u32le,
		name: RecordType.string.fixed.reqTerm(16),
	},
};

const FATENTRY_LEN = 28; // sizeof(fatEntry)

// File flags.
const GLBF_ENCRYPTED = 0x00000001;

module.exports = class Archive_GRP_Build extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Raptor Game Library',
			games: [
				'Raptor',
			],
			glob: [
				'*.glb',
			],
		};

		// Attributes that can be changed per-file.
		md.caps.file.attributes.encrypted = true;

		md.caps.file.maxFilenameLen = 12;

		return md;
	}

	static identify(content) {
		try {
			Debug.push(FORMAT_ID, 'identify');

			if (content.length < FATENTRY_LEN) {
				Debug.log(`Content too short (< ${FATENTRY_LEN} b) => false`);
				return false;
			}

			let buffer = new RecordBuffer(content);

			const sig = recordTypes.header.signature.read(buffer);
			if (sig !== 0x09d19b64) {
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
		const crypto = GameCompression.getHandler('enc-glb-raptor');
		let archive = new Archive();
		let buffer = new RecordBuffer(content);

		const rbHeader = new RecordBuffer(crypto.reveal(
			buffer.getU8(0, FATENTRY_LEN),
			{
				blockSize: FATENTRY_LEN,
			}
		));
		const header = rbHeader.readRecord(recordTypes.header);

		const rbFAT = new RecordBuffer(crypto.reveal(
			buffer.getU8(FATENTRY_LEN, FATENTRY_LEN * header.fileCount),
			{
				blockSize: FATENTRY_LEN,
			}
		));

		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = rbFAT.readRecord(recordTypes.fatEntry);

			let file = new Archive.File();
			file.name = fatEntry.name;
			file.diskSize = file.nativeSize = fatEntry.size;
			file.offset = fatEntry.offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);

			if (fatEntry.flags & GLBF_ENCRYPTED) {
				file.attributes.encrypted = true;
				file.getContent = () => crypto.reveal(file.getRaw());
			} else {
				file.attributes.encrypted = false;
			}

			archive.files.push(file);
		}

		return archive;
	}

	static generate(archive)
	{
		const header = {
			signature: 0, // when decrypted
			fileCount: archive.files.length,
		};

		// Work out where the FAT ends and the first file starts.
		const lenFAT = FATENTRY_LEN * (header.fileCount + 1);

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			lenFAT,
		);

		let buffer = new RecordBuffer(finalSize);

		// Write the FAT to a cleartext buffer for later encryption.
		let bufFAT = new RecordBuffer(lenFAT);
		bufFAT.writeRecord(recordTypes.header, header);

		let offset = lenFAT;
		archive.files.forEach(file => {
			const entry = {
				// Encrypt if attribute is either on or "don't care"
				flags: file.attributes.encrypted !== false ? GLBF_ENCRYPTED : 0,
				offset: offset,
				size: file.nativeSize,
				name: file.name,
			};
			bufFAT.writeRecord(recordTypes.fatEntry, entry);
			offset += file.nativeSize;
		});

		// Encrypt the FAT and write it to the main output.
		const crypto = GameCompression.getHandler('enc-glb-raptor');
		buffer.put(
			crypto.obscure(bufFAT.getU8(), {blockSize: FATENTRY_LEN})
		);

		archive.files.forEach(file => {
			const content = file.getContent();

			// Safety check.
			if (content.length != file.nativeSize) {
				throw new Error('Length of data and nativeSize field do not match!');
			}

			if (file.attributes.encrypted !== false) {
				buffer.put(
					crypto.obscure(content)
				);
			} else {
				buffer.put(content);
			}
		});

		return {
			main: buffer.getU8(),
		};
	}
};
