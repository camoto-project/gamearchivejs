/*
 * F.A.S.T engine .DAT format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/DAT_Format_%28Monster_Bash%29
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

const FORMAT_ID = 'arc-dat-fast';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { cmp_lzw, cmp_rle_bash } from '@camoto/gamecomp';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension } from '../util/supp.js';

const recordTypes = {
	fatEntry: {
		typeCode: RecordType.int.u16le,
		compressedSize: RecordType.int.u16le,
		name: RecordType.string.fixed.reqTerm(31),
		decompressedSize: RecordType.int.u16le, // 0 if not compressed
	},
};

const FATENTRY_LEN = 37; // sizeof(fatEntry)

/// Safety limit, actual format is unlimited
const MAX_FILES = 1024;

const FASTTypes = {
	0: ['.mif', 'map/fast-info'],
	1: ['.mbg', 'map/fast-bg'],
	2: ['.mfg', 'map/fast-fg'],
	3: ['.tbg', 'tileset/fast-4p'],
	4: ['.tfg', 'tileset/fast-5p'],
	5: ['.tbn', 'tileset/fast-5p'],
	6: ['.sgl', 'map/fast-spritelist'],
	7: ['.msp', 'map/fast-sprites'],
	8: ['', 'sound/inverse'],
	12: ['.pbg', 'data/fast-tileprops'],
	13: ['.pfg', 'data/fast-tileprops'],
	14: ['.pal', 'palette/ega'],
	16: ['.pbn', 'data/fast-tileprops'],
	32: ['', undefined],
	64: ['.spr', 'image/fast-sprite'],
};

const cmpDefaultParams = {
	initialBits: 9,
	maxBits: 12,
	cwEOF: 256,
	cwFirst: 257,
	bigEndian: false,
	flushOnReset: false,
};

export default class Archive_DAT_FAST extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'F.A.S.T. Data File',
			games: [
				'Monster Bash',
			],
			glob: [
				'*.dat',
			],
		};

		// Files can optionally be compressed.
		md.caps.file.attributes.compressed = true;

		md.caps.file.maxFilenameLen = 30;

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'dat'),
		};
	}

	static identify(content) {
		let buffer = new RecordBuffer(content);

		for (let i = 0; i < MAX_FILES; i++) {
			// If we're exactly at the EOF then we're done.
			const bytesLeft = buffer.distFromEnd();
			if (bytesLeft === 0) {
				return {
					valid: true,
					reason: `EOF at correct place.`,
				};
			}

			if (bytesLeft < FATENTRY_LEN) {
				return {
					valid: false,
					reason: `Incomplete FAT entry (${bytesLeft} bytes is less than the `
						+ `required ${FATENTRY_LEN}).`,
				};
			}

			const file = buffer.readRecord(recordTypes.fatEntry);
			const invalidChar = [...file.name].find(c => {
				const cc = c.charCodeAt(0);
				return (cc <= 32) || (cc > 126);
			});
			if (invalidChar !== undefined) {
				return {
					valid: false,
					reason: `File ${i} contains invalid (UTF-8) char 0x${invalidChar.charCodeAt(0).toString(16)}.`,
				};
			}

			if (buffer.distFromEnd() < file.compressedSize) {
				return {
					valid: false,
					reason: `File ${i} would go past EOF.`,
				};
			}
			buffer.seekRel(file.compressedSize);
		}

		return {
			valid: false,
			reason: `Too many files (bailing at ${MAX_FILES}).`,
		};
	}

	static parse({main: content}) {
		let archive = new Archive();

		let buffer = new RecordBuffer(content);

		let nextOffset = FATENTRY_LEN;
		for (let i = 0; i < MAX_FILES; i++) {
			// If we're exactly at the EOF then we're done.
			if (buffer.distFromEnd() === 0) break;
			// TODO: Handle trailing data less than a FAT entry in size
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);
			let offset = nextOffset; // copy inside closure for f.get()

			let file = new File();
			file.diskSize = fatEntry.compressedSize;
			file.offset = offset;

			// Convert the file type code into a filename extension if needed.
			const tc = FASTTypes[fatEntry.typeCode];
			if (tc) {
				file.name = fatEntry.name + tc[0];
				file.type = tc[1];
			} else {
				file.name = fatEntry.name;
				file.type = undefined;
			}

			file.getRaw = () => buffer.getU8(offset, file.diskSize);
			if (fatEntry.decompressedSize === 0) { // file is not compressed
				file.nativeSize = file.diskSize;
				file.attributes.compressed = false;

			} else { // file is compressed
				file.nativeSize = fatEntry.decompressedSize;
				file.attributes.compressed = true;

				// Override getContent() to decompress the file first.
				file.getContent = () => {
					const fileParams = {
						...cmpDefaultParams,
						// Some files have trailing bytes so we'll allocate a little extra
						// memory to avoid a buffer resize right at the end.
						finalSize: fatEntry.nativeSize + 16,
					};
					// Decompress with LZW, then decode with RLE.
					const decomp = cmp_rle_bash.reveal(
						cmp_lzw.reveal(file.getRaw(), fileParams)
					);

					// Since the compression algorithm often leaves an extra null byte
					// at the end of the data, we need to truncate it to the size given in
					// the file header.
					return decomp.slice(0, file.nativeSize);
				};
			}

			archive.files.push(file);

			// All done, go to the next file.
			nextOffset += fatEntry.compressedSize + FATENTRY_LEN;
			buffer.seekRel(fatEntry.compressedSize);
		}

		return archive;
	}

	static generate(archive)
	{
		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			FATENTRY_LEN * archive.files.length
		);

		let buffer = new RecordBuffer(finalSize);

		for (const file of archive.files) {
			const entry = {
				typeCode: 32,
				name: file.name,
			};
			const ext = entry.name.substr(-4).toLowerCase();
			if (ext === '.snd') { // special case
				entry.typeCode = 8;
				// extension isn't removed
			} else {
				Object.keys(FASTTypes).some(typeCode => {
					if (FASTTypes[typeCode][0] === '') return false;
					if (ext === FASTTypes[typeCode][0]) {
						entry.typeCode = typeCode;
						// Remove filename extension
						entry.name = entry.name.substr(0, entry.name.length-4);
						return true;
					}
					return false; // keep going
				});
			}

			const nativeData = file.getContent();

			// Safety check.
			if (nativeData.length != file.nativeSize) {
				throw new Error('Length of data and nativeSize field do not match!');
			}

			let diskData;
			if (file.attributes.compressed === false) { // compression not wanted
				diskData = nativeData;

				// Files that aren't compressed have the decompressed size set to 0 in
				// this archive format.
				entry.decompressedSize = 0;
				entry.compressedSize = file.nativeSize;
			} else { // compression wanted or don't care/default
				// Compress the file
				diskData = cmp_lzw.obscure(
					cmp_rle_bash.obscure(nativeData),
					cmpDefaultParams
				);

				// Set the size of the decompressed data in the header
				entry.decompressedSize = file.nativeSize;
				entry.compressedSize = diskData.length;
			}

			buffer.writeRecord(recordTypes.fatEntry, entry);
			buffer.put(diskData);
		}

		return {
			main: buffer.getU8(),
		};
	}
}
