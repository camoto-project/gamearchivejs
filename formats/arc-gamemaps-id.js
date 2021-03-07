/*
 * id Software Gamemaps format handler.
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
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceBasename, getBasename } from '../util/supp.js';

const recordTypes = {
	maphead: {
		header: {
			flag: RecordType.int.u16le,
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
			/*
			 * This is technically part of the header but we will treat it as a
			 * separate file so that the data is available to users.
			width: RecordType.int.u16le,
			height: RecordType.int.u16le,
			name: RecordType.string.fixed.reqTerm(16),
			*/
		},
	},
};

export default class Archive_Gamemaps_id extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'id Software GAMEMAPS File',
			games: [
				'Bio Menace',
				'Blake Stone',
				'Catacomb 3-D',
				'Catacomb Abyss',
				'Catacomb Armageddon',
				'Catacomb Apocalypse',
				'Corridor 7',
				'Commander Keen 4-6 + Dreams',
				'Noah\'s Ark 3D',
				'Operation Body Count',
				'Spear of Destiny',
				'Wolfenstein 3-D',
			],
			glob: [
				'gamemaps.*',
			],
		};

		md.caps.file.maxFilenameLen = 15;

		return md;
	}

	static supps(name) {
		const basename = getBasename(name);
		let supps = {};
		switch (basename.toLowerCase()) {

			// maptemp.xxx -> mapthead.xxx
			case 'maptemp':
				supps.fat = replaceBasename(name, 'mapthead');
				break;

			// gamemaps.xxx -> maphead.xxx
			case 'gamemaps':
				supps.fat = replaceBasename(name, 'maphead');
				break;

			default:
				supps.fat = replaceBasename(name, 'maphead');
				break;
		}

		return supps;
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

		const sig = recordTypes.gamemaps.header.signature.read(buffer);
		if (sig !== 'TED5v1.0') {
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

	static parse({ main: content, fat }) {
		let archive = new Archive();
		const lenArchive = content.length;

		let buffer = new RecordBuffer(content);
		let fatBuffer = new RecordBuffer(fat);

		let fatHeader = fatBuffer.readRecord(recordTypes.maphead.header);
		let hasRLEW = fatHeader.flag == 0xABCD;

		if (hasRLEW) {
			debug('RLEW not implemented yet!');
		}

		for (let i = 0; i < 100; i++) {
			const offLevelHeader = fatBuffer.read(RecordType.int.u32le);
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
			// Skip over remaining header data we aren't using (width, height, name).
			buffer.seekRel(2 * 2 + 16);

			for (let p = 0; p < 3; p++) {
				const offset = levelHeader[`offPlane${p}`];
				if (offset === 0) continue; // plane not present
				let file = new File();
				file.name = `${levelCode}/plane${p}`;
				file.diskSize = file.nativeSize = levelHeader[`lenPlane${p}`];
				file.offset = offset;
				file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
				archive.files.push(file);
			}

			// Add end of level header (width, height and title) as 'info' file.
			let file = new File();
			file.name = `${levelCode}/info`;
			file.diskSize = file.nativeSize = 20;
			file.offset = offLevelHeader + (4 + 2) * 3;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
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
			archive.files.push(file);
		}

		return archive;
	}

	static generate(archive)
	{
		let output = [];
		let fileCount = 0;
		let tileinfo;
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
			switch (filename) {
				case 'plane0':
					output[intLevel][0] = file.getContent();
					break;
				case 'plane1':
					output[intLevel][1] = file.getContent();
					break;
				case 'plane2':
					output[intLevel][2] = file.getContent();
					break;
				case 'info': {
					output[intLevel][3] = file.getContent();
					const actualSize = output[intLevel][3].length;
					const expectedSize = 2 + 2 + 16;
					if (actualSize != expectedSize) {
						throw new Error(`File "${file.name}" is ${actualSize} bytes in `
							+ `size, but it must be exactly ${expectedSize} bytes.`);
					}
					break;
				}
			}
		}

		// TODO: Compress files in output[].
		let lenCompressed = 0; // size of output[][0..2], not output[][3].

		let lenFAT = 2 + 4 * 100;
		if (tileinfo) lenFAT += tileinfo.length;
		let fatBuffer = new RecordBuffer(lenFAT);
		fatBuffer.writeRecord(recordTypes.maphead.header, {
			flag: 0xABCD,
		});

		const lenHeader = 3 * (4 + 2) + 2 + 2 + 16;
		let buffer = new RecordBuffer(8 + lenCompressed + fileCount * lenHeader);
		buffer.writeRecord(recordTypes.gamemaps.header, {
			signature: 'TED5v1.0',
		});

		for (let i = 0; i < 100; i++) {
			// If there are no files for this level number treat it as an empty level.
			if (!output[i]) {
				fatBuffer.write(RecordType.int.u32le, 0);
				continue;
			}

			// We have at least one subfile, so make sure we have them all.
			/*
			for (let p = 0; p < 3; p++) {
				if (!output[i][p]) {
					throw new Error(`Missing mandatory file "${i.toString().padStart(2, '0')}/plane${p}".`);
				}
			}
			*/
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
}
