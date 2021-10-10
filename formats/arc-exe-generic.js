/*
 * Generic .exe file handler, for extracting embedded data from the header and
 * footer.
 *
 * This handler splits an .exe file up into multiple files:
 *
 *   - header.bin: The main .exe header, updated automatically and not terribly
 *     useful on its own.
 *   - post-header.dat: Can be modified to add custom data after the .exe
 *     header.  PKLite puts a copyright message here.  Any data is acceptable,
 *     but by convention it is fairly small (under 32 bytes).
 *   - reloc.bin: The relocation table.  Not useful on its own.
 *   - post-reloc.dat: Typically padding data.  Any data is acceptable here and
 *     is usually of medium length (under 1 kB).
 *   - code.bin: The actual machine code.
 *   - post-code.bin: Any data appended onto the end of the executable.  Any
 *     data is acceptable here and this is where larger data is usually stored
 *     (over 1 kB in size, no limit).  Self-extracting .zip files store the
 *     actual .zip data here, for example.
 *
 * Note that the header must be a multiple of 16 bytes, so additional bytes may
 * have to be added to meet this requirement.  They can be placed in
 * post-header.dat or post-reloc.bin (or split across both files).  Most .exe
 * files have a few 0x00 bytes in one or both of these locations for this
 * reason.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/EXE_Format
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

const FORMAT_ID = 'arc-exe-generic';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension } from '../util/supp.js';

const recordTypes = {
	header: {
		signature: RecordType.string.fixed.noTerm(2),
		lenLastBlock: RecordType.int.u16le,
		blockCount: RecordType.int.u16le,
		relocCount: RecordType.int.u16le,
		pgLenHeader: RecordType.int.u16le,
		pgMinExtra: RecordType.int.u16le,
		pgMaxExtra: RecordType.int.u16le,
		segSS: RecordType.int.s16le,
		regSP: RecordType.int.u16le,
		checksum: RecordType.int.u16le,
		regIP: RecordType.int.u16le,
		segCS: RecordType.int.s16le,
		offRelocTable: RecordType.int.u16le,
		overlayIndex: RecordType.int.u16le,
	},
};

const EXE_HEADER_LEN = 0x1C;

export default class Archive_EXE_Generic extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Generic MS-DOS Executable',
			games: [],
			glob: [
				'*.exe',
			],
		};

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'exe'),
		};
	}

	// Assumed file is already decompresed, e.g. with gamecomp/decompress_exe().
	static identify(content) {
		if (content.length < EXE_HEADER_LEN) {
			return {
				valid: false,
				reason: `Content too short (< ${EXE_HEADER_LEN} b).`,
			};
		}

		let buffer = new RecordBuffer(content);

		const header = buffer.readRecord(recordTypes.header);
		if (header.signature !== 'MZ') {
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

	// Assumed file is already decompresed, e.g. with gamecomp/decompress_exe().
	static parse(content) {
		let archive = new Archive();
		let buffer = new RecordBuffer(content.main);
		const header = buffer.readRecord(recordTypes.header);

		{
			let file = new File();
			file.name = 'header.bin';
			file.offset = 0;
			file.diskSize = file.nativeSize = EXE_HEADER_LEN - file.offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.attributes.compressed = false;
			file.attributes.encrypted = false;
			archive.files.push(file);
		}
		{
			let file = new File();
			file.name = 'post-header.dat';
			file.offset = EXE_HEADER_LEN;
			file.diskSize = file.nativeSize = header.offRelocTable - file.offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.attributes.compressed = false;
			file.attributes.encrypted = false;
			archive.files.push(file);
		}
		{
			let file = new File();
			file.name = 'reloc.bin';
			file.offset = header.offRelocTable;
			file.diskSize = file.nativeSize = header.relocCount * 4;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.attributes.compressed = false;
			file.attributes.encrypted = false;
			archive.files.push(file);
		}
		{
			let file = new File();
			file.name = 'post-reloc.dat';
			file.offset = header.offRelocTable + header.relocCount * 4;
			file.diskSize = file.nativeSize = (header.pgLenHeader << 4) - file.offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.attributes.compressed = false;
			file.attributes.encrypted = false;
			archive.files.push(file);
		}
		const totalSize = (header.blockCount - 1) * 512 + (header.lenLastBlock || 512);
		{
			let file = new File();
			file.name = 'code.bin';
			file.offset = header.pgLenHeader << 4;
			file.diskSize = file.nativeSize = totalSize - file.offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.attributes.compressed = false;
			file.attributes.encrypted = false;
			archive.files.push(file);
		}
		{
			let file = new File();
			file.name = 'post-code.dat';
			file.offset = totalSize;
			file.diskSize = file.nativeSize = buffer.length - totalSize;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.attributes.compressed = false;
			file.attributes.encrypted = false;
			archive.files.push(file);
		}

		return archive;
	}

	static generate(archive)
	{
		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			0,
		);

		let buffer = new RecordBuffer(finalSize);

		if (archive.files[0].name !== 'header.bin') {
			throw new Error('Only .exe files can be saved back to .exe files.');
		}

		// Read the intended header.
		const bufHeader = new RecordBuffer(archive.files[0].getContent());
		let exeHeader = bufHeader.readRecord(recordTypes.header);

		const lenFile1Header = archive.files[1].nativeSize;
		const lenFile2Reloc = archive.files[2].nativeSize;
		const lenFile3RelocExtra = archive.files[3].nativeSize;
		const lenFile5Tail = archive.files[5].nativeSize;

		if (lenFile2Reloc & 0x3) {
			throw new Error(`reloc.bin must be a multiple of 4.`);
		}

		// Update the relevant fields based on the other files.
		const totalSize = finalSize - lenFile5Tail;
		exeHeader.blockCount = totalSize + 0x1FF >> 9;
		exeHeader.lenLastBlock = totalSize & 0x1FF;
		exeHeader.offRelocTable = EXE_HEADER_LEN + lenFile1Header;
		exeHeader.relocCount = lenFile2Reloc / 4;
		const lenHeader = exeHeader.offRelocTable + lenFile2Reloc + lenFile3RelocExtra;
		exeHeader.pgLenHeader = lenHeader >> 4;

		if (lenHeader & 0xF) {
			const numRemove = lenHeader & 0x0F;
			const numExtra = 0xF - numRemove;
			throw new Error(`Header length is not a multiple of 16.  A total of `
				+ `${numExtra} byte(s) must be added or ${numRemove} byte(s) removed.  `
				+ `These bytes must be added to or removed from either post-header.dat `
				+ `or post-reloc.dat (or split between both files).`);
		}

		// Write the correct header.
		buffer.writeRecord(recordTypes.header, exeHeader);

		for (let i = 1; i < archive.files.length; i++) {
			buffer.put(archive.files[i].getContent());
		}

		return {
			main: buffer.getU8(),
		};
	}
}
