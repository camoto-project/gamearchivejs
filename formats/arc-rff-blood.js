/**
 * @file Blood .RFF format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/RFF_Format
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

const FORMAT_ID = 'arc-rff-blood';

const { RecordBuffer, RecordType } = require('@camoto/record-io-buffer');
const GameCompression = require('@camoto/gamecomp');

const ArchiveHandler = require('./archiveHandler.js');
const Archive = require('./archive.js');
const Debug = require('../util/utl-debug.js');
const g_debug = Debug.extend(FORMAT_ID);

const recordTypes = {
	header: {
		signature: RecordType.int.u32le,
		version: RecordType.int.u16le,
		pad: RecordType.padding(2),
		fatOffset: RecordType.int.u32le,
		fileCount: RecordType.int.u32le,
		pad2: RecordType.padding(16),
	},
	fatEntry: {
		cache: RecordType.padding(16),
		offset: RecordType.int.u32le,
		diskSize: RecordType.int.u32le,
		packedSize: RecordType.int.u32le,
		lastModified: RecordType.int.u32le,
		flags: RecordType.int.u8,
		ext: RecordType.string.fixed.optTerm(3),
		basename: RecordType.string.fixed.optTerm(8),
		id: RecordType.int.u32le,
	},
};

const HEADER_LEN = 32; // sizeof(header)
const FATENTRY_LEN = 48; // sizeof(fatEntry)

// Number of bytes encrypted from start of file
const RFF_FILE_CRYPT_LEN = 256;

const RFF_SIG = 0x1A464652; // RFF\x1A

const RFFFlags = {
	FILE_ENCRYPTED: 0x10,
};

class Archive_RFF_Blood extends ArchiveHandler
{
	static metadata() {
		const vFull = this.version();
		const vHigh = vFull >> 8;
		const vLow = vFull & 0xFF;
		let md = {
			...super.metadata(),
			id: FORMAT_ID + '-v' + vFull.toString(16),
			title: 'Monolith Resource File Format v' + vHigh + '.' + vLow,
			games: [
				'Blood',
			],
			glob: [
				'*.rff',
			],
		};
		// This format can save the last-modified time of files.
		md.caps.file.lastModified = true;

		// Some versions of this format support encryption.
		const crypto = this.getCrypto();
		md.caps.file.attributes.encrypted = !!crypto;

		md.caps.file.maxFilenameLen = 12;

		return md;
	}

	static identify(content) {
		const md = this.metadata();
		const debug = g_debug.extend(`${md.id}:identify`);

		if (content.length < HEADER_LEN) {
			return {
				valid: false,
				reason: `Content too short (< ${HEADER_LEN} b).`,
			};
		}

		let buffer = new RecordBuffer(content);

		const header = buffer.readRecord(recordTypes.header);
		if (header.signature !== RFF_SIG) {
			return {
				valid: false,
				reason: `Wrong signature.`,
			};
		}

		if (header.version != this.version()) {
			const vHigh = header.version >> 8;
			const vLow = header.version & 0xFF;
			return {
				valid: false,
				reason: `Unsupported RFF version ${vHigh}.${vLow}.`,
			};
		}

		return {
			valid: true,
			reason: `Signature matched, version OK.`,
		};
	}

	static parse({main: content}) {
		const md = this.metadata();
		const debug = g_debug.extend(`${md.id}:parse`);

		let archive = new Archive();
		const lenArchive = content.length;

		let buffer = new RecordBuffer(content);
		let header = buffer.readRecord(recordTypes.header);

		debug(`Contains ${header.fileCount} files, version 0x`
			+ header.version.toString(16));

		const crypto = this.getCrypto();
		let fat = buffer.getU8(header.fatOffset, header.fileCount * FATENTRY_LEN);
		if (crypto) {
			fat = crypto.reveal(fat, {
				seed: header.fatOffset & 0xFF,
				offset: this.getKeyOffset_FAT(),
				limit: 0,
			});
		}
		fat = new RecordBuffer(fat);

		const tzOffset = new Date().getTimezoneOffset() * 60;

		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = fat.readRecord(recordTypes.fatEntry);
			if (fatEntry.offset > lenArchive) {
				debug(`File #${i} (${fatEntry.basename}.${fatEntry.ext}) has `
					+ `offset ${fatEntry.offset}, past archive EOF at ${lenArchive}`);
				console.error('Archive truncated, returning partial content');
				break;
			}

			let file = new Archive.File();
			file.name = fatEntry.basename;
			file.diskSize = fatEntry.diskSize;
			file.nativeSize = fatEntry.diskSize;
			if (fatEntry.ext) file.name += '.' + fatEntry.ext;

			// The file's last-modified time is in local time, but when we create
			// a date object from a UNIX timestamp it's assumed to be in UTC.  So
			// we have to add the local timezone onto it to keep it as local time.
			const unixTimeUTC = fatEntry.lastModified + tzOffset;
			file.lastModified = new Date(unixTimeUTC * 1000);

			file.getRaw = () => buffer.getU8(fatEntry.offset, fatEntry.diskSize);

			if (crypto) {
				if (fatEntry.flags & RFFFlags.FILE_ENCRYPTED) {
					// Override the function to get the file content with one that
					// decrypts the data first.
					file.getContent = () => {
						return crypto.reveal(file.getRaw(), {
							seed: 0,
							offset: this.getKeyOffset_File(),
							limit: RFF_FILE_CRYPT_LEN,
						});
					};
					file.attributes.encrypted = true;
				} else {
					file.attributes.encrypted = false;
				}
			}
			archive.files.push(file);
		}

		return archive;
	}

	static generate(archive)
	{
		const crypto = this.getCrypto();

		// Calculate the size up front (if all the diskSize fields are available)
		// so we don't have to keep reallocating the buffer, improving performance.
		const lenFAT = archive.files.length * FATENTRY_LEN;
		const guessFinalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			HEADER_LEN + lenFAT
		);

		let buffer = new RecordBuffer(guessFinalSize);

		// Skip over the header, we'll write it last when we know the FAT offset.
		buffer.seekAbs(HEADER_LEN);
		let nextOffset = HEADER_LEN;

		let fat = new RecordBuffer(lenFAT);

		// Since the archive does not store a timezone, we assume, like DOS, that
		// the times are local time on the current PC.
		// Since Date.now() returns time since UTC 1970, we need to add the local
		// timezone onto that so that to convert it into seconds since 1970 local
		// time.
		const tzOffset = new Date().getTimezoneOffset() * 60;
		let now = Math.round(Date.now() / 1000) - tzOffset;

		archive.files.forEach(file => {
			let content = file.getContent();

			// Safety check.
			if (content.length != file.nativeSize) {
				throw new Error('Length of data and nativeSize field do not match!');
			}

			let rffFile = {...file};
			if (file.lastModified) {
				// Again we have to include the current timezone so that we are writing
				// local time rather than UTC to the file.
				rffFile.lastModified = file.lastModified.valueOf() / 1000 - tzOffset;
			} else {
				rffFile.lastModified = now;
			}
			rffFile.diskSize = content.length;
			rffFile.cache = '';
			rffFile.offset = nextOffset;
			rffFile.packedSize = 0;
			rffFile.flags = 0;
			if (!rffFile.id) rffFile.id = 0;
			[rffFile.basename, rffFile.ext] = file.name.split('.');
			if (!rffFile.ext) rffFile.ext = '';

			if (crypto) {
				// If encryption hasn't been specifically disabled, then encrypt
				if (file.attributes.encrypted !== false) {
					rffFile.flags |= RFFFlags.FILE_ENCRYPTED;
					content = crypto.obscure(content, {
						seed: 0,
						offset: this.getKeyOffset_File(),
						limit: RFF_FILE_CRYPT_LEN,
					});
				}
			}
			buffer.put(content);

			fat.writeRecord(recordTypes.fatEntry, rffFile);

			nextOffset += rffFile.diskSize;
		});

		const header = {
			signature: RFF_SIG,
			version: this.version(),
			pad: 0,
			fatOffset: nextOffset,
			fileCount: archive.files.length,
			pad2: '',
		};

		// Write the FAT at the end, possibly encrypted
		if (crypto) {
			fat = crypto.obscure(fat.getU8(), {
				seed: header.fatOffset & 0xFF,
				offset: this.getKeyOffset_FAT(),
				limit: 0, // fully encrypted
			});
		} else {
			fat = fat.getU8(); // for consistency
		}
		buffer.put(fat);

		// Go back and write the header now we know the FAT offset
		buffer.seekAbs(0);
		buffer.writeRecord(recordTypes.header, header);

		return {
			main: buffer.getU8(),
		};
	}

}

class Archive_RFF_Blood_v200 extends Archive_RFF_Blood
{
	static version() {
		return 0x200;
	}

	static getCrypto() {
		return null;
	}

	static getKeyOffset_File() {
		return 0;
	}

	static getKeyOffset_FAT() {
		return 0;
	}
}

class Archive_RFF_Blood_v300 extends Archive_RFF_Blood
{
	static version() {
		return 0x300;
	}

	static getCrypto() {
		return GameCompression.getHandler('enc-xor-blood');
	}

	static getKeyOffset_File() {
		// Even in v300 the files themselves were in the v301 format
		return 0;
	}

	static getKeyOffset_FAT() {
		return 1;
	}
}

class Archive_RFF_Blood_v301 extends Archive_RFF_Blood
{
	static version() {
		return 0x301;
	}

	static getCrypto() {
		return GameCompression.getHandler('enc-xor-blood');
	}

	static getKeyOffset_File() {
		return 0;
	}

	static getKeyOffset_FAT() {
		return 0;
	}
}

module.exports = [
	Archive_RFF_Blood_v200,
	Archive_RFF_Blood_v300,
	Archive_RFF_Blood_v301,
];
