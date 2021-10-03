/*
 * Papyrus V1 .DAT format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/DAT_Format_(Papyrus)
 *
 * Copyright (C) 2018-2021 Adam Nielsen <malvineous@shikadi.net>
 * Copyright (C) 2021 Colin Bourassa
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

const FORMAT_ID = 'arc-dat-papyrus-v1';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { cmp_lzss } from '@camoto/gamecomp';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension } from '../util/supp.js';

const recordTypes = {
	header: {
		fileCount: RecordType.int.u16le,
	},
	fatEntry: {
		flags: RecordType.int.u16le,
		nativeSize: RecordType.int.u32le,
		diskSize: RecordType.int.u32le,
		name: RecordType.string.fixed.optTerm(14),
		offset: RecordType.int.u32le,
	},
	prefixWords: {
		width: RecordType.int.u16le,
		height: RecordType.int.u16le,
	},
};

const HEADER_LEN = 2; // sizeof(header)
const FATENTRY_LEN = 28; // sizeof(fatEntry)

const PDAT_COMPRESSED = 0x0100;
const PDAT_NOPREFIXWORDS = 0x0004;

const cmpParams = {
	bitstream: false,
	invertFlag: true,
	lengthHigh: true,
	littleEndian: true,
	minDistance: 0,
	minLength: 3,
	prefillByte: 0x20,
	relativeDistance: false,
	rotateDistance: 0,
	sizeDistance: 12,
	sizeLength: 4,
	windowStartAt0: false,
};

export default class Archive_DAT_PapyrusV1 extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Papyrus v1 DAT File',
			games: [
				'J.R.R. Tolkien\'s Riders of Rohan',
				'Nomad',
			],
			glob: [
				'*.dat',
			],
		};

		md.caps.file.maxFilenameLen = 14;
		// The user can control which files are and aren't compressed.
		md.caps.file.attributes.compressed = true;
		md.caps.file.attributes.hasPrefixWords = false;
		md.caps.file.attributes.uncompressedPrefixWords = {
			width: RecordType.int.u16le,
			height: RecordType.int.u16le,
		};

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'dat'),
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

		const header = buffer.readRecord(recordTypes.header);
		const offEndFAT = HEADER_LEN + header.fileCount * FATENTRY_LEN;

		if (content.length < offEndFAT) {
			return {
				valid: false,
				reason: `Content too short for file count.`,
			};
		}

		// Read each offset and length and ensure it is valid.
		let lastEOF = HEADER_LEN;
		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			if (fatEntry.offset >= content.length) {
				return {
					valid: false,
					reason: `File ${i} @ offset ${fatEntry.offset} starts beyond the end of the archive.`,
				};
			}
			lastEOF = fatEntry.offset + fatEntry.diskSize;
			if (lastEOF > content.length) {
				return {
					valid: false,
					reason: `File ${i} ends beyond the end of the archive.`,
				};
			}
		}

		if (lastEOF !== content.length) {
			return {
				valid: false,
				reason: `Trailing data after last file.`,
			};
		}

		return {
			valid: true,
			reason: `All file offsets/lengths are within the bounds of the archive file size.`,
		};
	}

	static parse({main: content}) {
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
			file.attributes.encrypted = false;

			// If the "no prefix" bit is clear, we need to skip ahead by four bytes
			// because the contained file is a raw image (headerless) image that is
			// prefixed by two 16-bit words that describe width and height. These
			// two words are not included in the LZ compressed data, nor are they
			// included in the file size.
			file.attributes.hasPrefixWords = (fatEntry.flags & PDAT_NOPREFIXWORDS) === 0;
			if (file.attributes.hasPrefixWords) {

				// save the current offset we're parsing in the FAT so that we can
				// return to it after reading the uncompressed prefix words
				const offsetInFAT = buffer.getPos();

				buffer.seekAbs(fatEntry.offset);

				file.attributes.uncompressedPrefixWords = buffer.readRecord(recordTypes.prefixWords);
				file.offset += 4;

				buffer.seekAbs(offsetInFAT);
			} else {
				file.attributes.uncompressedPrefixWords = {};
			}

			// use LZSS decompression only if the 'compressed' flag is set
			if (fatEntry.flags & PDAT_COMPRESSED) {
				file.attributes.compressed = true;
				file.getContent = () => cmp_lzss.reveal(file.getRaw(), cmpParams);
			} else {
				file.attributes.compressed = false;
			}

			archive.setOriginalFile(file);
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
		// next; this allows us to determine the in-archive size of the files
		// as they are compressed (if necessary)
		buffer.seekAbs(offEndFAT);

		for (const file of archive.files) {

			if (file.attributes.hasPrefixWords === true) {
				buffer.writeRecord(recordTypes.prefixWords, file.attributes.uncompressedPrefixWords);
			}

			let diskData;
			if (archive.isFileModified(file)) {
				// Content has been replaced, (or it's unchanged but the compression
				// attribute was changed), so compress it.

				// Load the content, which may decompress the source file.
				const nativeData = file.getContent();

				// Safety check.
				if (nativeData.length != file.nativeSize) {
					throw new Error(`Length of data (${nativeData.length}) and nativeSize `
						+ `(${file.nativeSize}) field do not match for ${file.name}!`);
				}

				if (file.attributes.compressed === true) {
					// Compression wanted.
					diskData = cmp_lzss.obscure(nativeData, cmpParams);
				} else {
					// Compression not wanted or don't care/default.
					diskData = nativeData;
				}
			} else {
				// The content for this file hasn't been replaced, so for performance
				// reasons, avoid decompressing and then recompressing it, and just use
				// the original data as-is.
				diskData = file.getRaw();
			}

			file.diskSize = diskData.length;
			buffer.put(diskData);
		}

		// now, go back and write the FAT
		buffer.seekAbs(HEADER_LEN);
		let nextOffset = offEndFAT;

		for (const file of archive.files) {

			const isCompressed = (file.attributes.compressed === true);
			const compressedFlag = (isCompressed ? PDAT_COMPRESSED : 0);
			const hasPrefixWords = (file.attributes.hasPrefixWords === true);
			const prefixWordFlag = (hasPrefixWords ? 0 : PDAT_NOPREFIXWORDS);

			const entry = {
				flags: 0x0001 | compressedFlag | prefixWordFlag,
				nativeSize: file.nativeSize,
				diskSize: (isCompressed ? file.diskSize : file.nativeSize),
				name: file.name,
				offset: nextOffset,
			};
			nextOffset += entry.diskSize;

			// If this file is a raw image (i.e. no built-in header), it will have
			// two 16-bit prefix words that describe the width and height. These
			// four bytes are not included in the filesizer, so add this to the offset.
			if (hasPrefixWords) {
				nextOffset += 4;
			}

			buffer.writeRecord(recordTypes.fatEntry, entry);
		}

		return {
			main: buffer.getU8(),
		};
	}
}
