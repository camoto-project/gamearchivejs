/*
 * id Software Gamemaps format handler for underlying RLEW-compressed data.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/GameMaps_Format
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

const FORMAT_ID = 'arc-gamemaps-id';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { cmp_rlew_id } from '@camoto/gamecomp';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceBasename } from '../util/supp.js';

const recordTypes = {
	maphead: {
		header: {
			rlewCode: RecordType.int.u16le,
		},
	},
	gamemaps: {
		header: {
			signature: RecordType.string.fixed.noTerm(8), // TED5v1.0
		},
		levelHeader: {
			offPlane0: RecordType.int.s32le,
			offPlane1: RecordType.int.s32le,
			offPlane2: RecordType.int.s32le,
			lenPlane0: RecordType.int.u16le,
			lenPlane1: RecordType.int.u16le,
			lenPlane2: RecordType.int.u16le,
		},
		// This is technically part of the header but we will treat it as a
		// separate file so that the data is available to users.
		levelHeaderPart2: {
			width: RecordType.int.u16le,
			height: RecordType.int.u16le,
			name: RecordType.string.fixed.reqTerm(16),
		},
	},
};

export default class Archive_Gamemaps_id extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'id Software GAMEMAPS File (RLEW)',
			games: [
				'Bio Menace',
				'Blake Stone',
				'Commander Keen 4-6',
				'Corridor 7',
				'Noah\'s Ark 3D',
				'Operation Body Count',
				'Wolfenstein 3-D v1.0',
			],
			glob: [
				'maptemp.*',
			],
		};

		// Files can be compressed.
		md.caps.file.attributes.compressed = true;

		md.caps.file.maxFilenameLen = 15;

		return md;
	}

	static supps(name) {
		return {
			// maptemp.xxx -> maphead.xxx
			fat: replaceBasename(name, 'maphead'),
			main: replaceBasename(name, 'maptemp'),
		};
	}

	static identify(content) {
		const lenSig = 8;
		if (content.length < lenSig) {
			return {
				valid: false,
				reason: `Content too short (< ${lenSig} b).`,
			};
		}

		let buffer = new RecordBuffer(content);

		const head = buffer.readRecord(recordTypes.gamemaps.header);
		if (head.signature !== 'TED5v1.0') {
			return {
				valid: false,
				reason: `Wrong signature.`,
			};
		}

		// Search for an '!ID!' signature.
		const expSig = [...'!ID!'].map(a => a.charCodeAt(0));
		for (let i = 8; i < content.length - 4; i++) {
			if (
				(content[i] === expSig[0])
				&& (content[i + 1] === expSig[1])
				&& (content[i + 2] === expSig[2])
				&& (content[i + 3] === expSig[3])
			) {
				// Found a signature, look for the header.
				if (i + 4 + 38 > content.length) {
					return {
						valid: false,
						reason: `Found !ID! header, but at EOF.`,
					};
				}
				buffer.seekAbs(i + 4);
				const levelHeader = buffer.readRecord(recordTypes.gamemaps.levelHeader);
				const levelHeaderPart2 = buffer.readRecord(recordTypes.gamemaps.levelHeaderPart2);
				const expectedPlaneLength = levelHeaderPart2.width * levelHeaderPart2.height * 2;
				debug(levelHeader, levelHeaderPart2);
				if (levelHeader.offPlane0 + 2 > content.length) {
					return {
						valid: false,
						reason: `Found !ID! header, but plane is too short.`,
					};
				}
				buffer.seekAbs(levelHeader.offPlane0);
				const lenDecompressed = buffer.read(RecordType.int.u16le);
				if (lenDecompressed === expectedPlaneLength) {
					return {
						valid: true,
						reason: 'Signature matched and first level plane is expected length.',
					};
				}

				// This means there's another level of decompression that has to
				// happen, so it's one of the other variants.
				return {
					valid: false,
					reason: `Found !ID! header, but plane is wrong length.`,
				};
			}
		}

		return {
			valid: undefined,
			reason: `Signature matched but no !ID! marker found.`,
		};
	}

	static parse({ main: content, fat }) {
		let archive = new Archive();
		const lenArchive = content.length;

		let buffer = new RecordBuffer(content);
		let fatBuffer = new RecordBuffer(fat);

		let fatHeader = fatBuffer.readRecord(recordTypes.maphead.header);

		for (let i = 0; i < 100; i++) {
			const offLevelHeader = fatBuffer.read(RecordType.int.s32le);
			if (offLevelHeader > lenArchive) {
				debug(`Level ${i + 1}'s offset ${offLevelHeader} is beyond the end of `
					+ `the level data (${lenArchive}).`);
				break;
			}
			const levelCode = i.toString().padStart(2, '0');
			if (offLevelHeader <= 0) {
				// Create an empty level
				let file = new File();
				file.name = levelCode + '/';
				file.diskSize = file.nativeSize = 0;
				file.offset = null;
				file.getRaw = () => {
					throw new Error('This is a folder, not a file');
				};
				archive.files.push(file);

				continue;
			}

			buffer.seekAbs(offLevelHeader);
			const levelHeader = buffer.readRecord(recordTypes.gamemaps.levelHeader);
			const levelHeaderPart2 = buffer.readRecord(recordTypes.gamemaps.levelHeaderPart2);

			for (let p = 0; p < 3; p++) {
				const offset = levelHeader[`offPlane${p}`];
				if (offset <= 0) continue; // plane not present

				let file = new File();
				file.name = `${levelCode}/plane${p}`;
				file.attributes.compressed = true;
				file.diskSize = levelHeader[`lenPlane${p}`];
				file.nativeSize = levelHeaderPart2.width * levelHeaderPart2.height * 2;
				file.offset = offset;
				file.getRaw = () => buffer.getU8(file.offset, file.diskSize);

				// Override getContent() to decompress the file first.
				file.getContent = () => {
					const raw = buffer.getU8(file.offset, file.diskSize);
					return this.decompress(raw, fatHeader.rlewCode);
				};
				archive.files.push(file);
			}

			// Add end of level header (width, height and title) as 'info' file.
			let file = new File();
			file.name = `${levelCode}/info`;
			file.diskSize = file.nativeSize = 20;
			file.offset = offLevelHeader + (4 + 2) * 3;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			// This data is never compressed so no need to override getContent().
			archive.files.push(file);
		}

		const lenOffsets = 2 + 100 * 4;
		if (fatBuffer.length > lenOffsets) {
			// There is trailing tileinfo data
			let file = new File();
			file.name = `tileinfo`;
			file.diskSize = file.nativeSize = fatBuffer.length - lenOffsets;
			file.offset = lenOffsets;
			file.getRaw = () => fatBuffer.getU8(file.offset, file.diskSize);
			// This data is never compressed so no need to override getContent().
			archive.files.push(file);
		}

		return archive;
	}

	static generate(archive)
	{
		const header = {
			rlewCode: 0xABCD,
		};

		let output = [];
		let fileCount = 0;
		let tileinfo;
		let lenCompressed = 0;
		for (const file of archive.files) {
			if (file.name === 'tileinfo') {
				tileinfo = file.getContent();
				continue;
			} else if (file.name[2] != '/') {
				throw new Error(`File "${file.name}" must start with "nn/" where 'n' `
					+ `is 0-9.`);
			}
			const strLevel = file.name.substr(0, 2);
			const intLevel = parseInt(strLevel, 10);
			if (intLevel.toString().padStart(2, '0') != strLevel) {
				throw new Error(`Filename "${file.name}" must be inside a folder `
					+ `with a two-digit name only, e.g. "01/".`);
			}

			if (!output[intLevel]) output[intLevel] = [];
			fileCount++;

			const filename = file.name.substr(3);
			let plane, compressed;
			switch (filename) {
				case '': continue; // empty/placeholder level
				case 'plane0': plane = 0; compressed = true; break;
				case 'plane1': plane = 1; compressed = true; break;
				case 'plane2': plane = 2; compressed = true; break;
				default: plane = 3; compressed = false; break; // info file
			}

			if (compressed) {
				const comp = this.compress(file.getContent(), header.rlewCode);
				output[intLevel][plane] = comp;
				// Only planes 0-2 are included here, the info file goes into the header
				// so isn't counted here.
				lenCompressed += comp.length;
			} else {
				output[intLevel][plane] = file.getContent();
			}

			if (filename === 'info') {
				const actualSize = output[intLevel][3].length;
				const expectedSize = 2 + 2 + 16;
				if (actualSize != expectedSize) {
					throw new Error(`File "${file.name}" is ${actualSize} bytes in `
						+ `size, but it must be exactly ${expectedSize} bytes.`);
				}
			}
		}

		let lenFAT = 2 + 4 * 100;
		if (tileinfo) lenFAT += tileinfo.length;
		let fatBuffer = new RecordBuffer(lenFAT);
		fatBuffer.writeRecord(recordTypes.maphead.header, header);

		const lenHeader = 3 * (4 + 2) + 2 + 2 + 16;
		let buffer = new RecordBuffer(8 + lenCompressed + fileCount * lenHeader);
		buffer.writeRecord(recordTypes.gamemaps.header, {
			signature: 'TED5v1.0',
		});

		for (let i = 0; i < 100; i++) {
			// If there are no files for this level number treat it as an empty level.
			if (!output[i] || (output[i].length === 0)) {
				fatBuffer.write(RecordType.int.u32le, 0);
				continue;
			}

			// This file is mandatory because we split it out from the header, so it's
			// not technically a file but the end of the header.
			if (!output[i][3]) {
				throw new Error(`Missing mandatory file "${i.toString().padStart(2, '0')}/info".`);
			}

			// Write offset to maphead.
			const offStart = buffer.getPos();
			fatBuffer.write(RecordType.int.u32le, offStart);

			// Work out the level header, skipping missing planes.
			let levelHeader = {};
			let lastOffset = offStart + lenHeader;
			for (let p = 0; p < 3; p++) {
				let lenPlane;
				if (output[i][p]) {
					levelHeader[`offPlane${p}`] = lastOffset;
					lenPlane = output[i][p].length;
				} else {
					levelHeader[`offPlane${p}`] = 0;
					lenPlane = 0;
				}
				levelHeader[`lenPlane${p}`] = lenPlane;
				lastOffset += lenPlane;
			}

			buffer.writeRecord(recordTypes.gamemaps.levelHeader, levelHeader);
			// Following data (width/height/name) comes from the 'info' file.
			buffer.put(output[i][3]);

			if (buffer.getPos() !== levelHeader.offPlane0) {
				const filename = `${i.toString().padStart(2, '0')}/plane0`;
				throw new Error(`BUG: Expected to write ${filename} at offset `
					+ `${levelHeader.offPlane0} but ended up at offset ${buffer.getPos()}!`);
			}

			// Write the plane content.
			for (let p = 0; p < 3; p++) {
				if (output[i][p]) {
					buffer.put(output[i][p]);
				}
			}
			// Put an !ID! signature after the plane data.  This isn't strictly
			// necessary but matches the format.  Note that RLEW-only variants
			// (arc-gamemaps-id) have the levelHeader last, after the plane data,
			// while Carmackized versions (arc-gamemaps-id-carmack) put the
			// levelHeader before the plane data.  Either way in both formats the !ID!
			// signature is placed after each level has been written.
			buffer.write(RecordType.string.fixed.noTerm(4), '!ID!');
		}

		// Put the tileinfo (if any) at the end of the maphead.
		if (tileinfo) {
			fatBuffer.put(tileinfo);
		}

		return {
			main: buffer.getU8(),
			fat: fatBuffer.getU8(),
		};
	}

	static compress(content, rlewCode) {
		const comp = cmp_rlew_id.obscure(content, { code: rlewCode });

		// Write the original size in the header.
		const buffer = new RecordBuffer(comp.length + 2);
		buffer.write(RecordType.int.u16le, content.length);
		buffer.put(comp);

		return buffer.getU8();
	}

	static decompress(content, rlewCode) {
		const buffer = new RecordBuffer(content);
		const lenDecompressed = buffer.read(RecordType.int.u16le);
		const body = buffer.getU8(2, buffer.length - 2);
		const decomp = cmp_rlew_id.reveal(body, { code: rlewCode } );

		// Trim the decompressed data in case there are trailing bytes.
		return decomp.slice(0, lenDecompressed);
	}
}
