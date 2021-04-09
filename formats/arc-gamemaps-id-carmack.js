/*
 * id Software Gamemaps format handler for RLEW + Carmackized variant.
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

const FORMAT_ID = 'arc-gamemaps-id-carmack';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { cmp_carmackize } from '@camoto/gamecomp';
import Archive_Gamemaps_id from './arc-gamemaps-id.js';
import { replaceBasename } from '../util/supp.js';

const recordTypes = {
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

export default class Archive_Gamemaps_id_Carmack extends Archive_Gamemaps_id
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'id Software GAMEMAPS File (RLEW + Carmack)',
			games: [
				'Catacomb 3-D',
				'Catacomb Abyss',
				'Catacomb Armageddon',
				'Catacomb Apocalypse',
				'Rescue Rover 2',
				'Spear of Destiny',
				'Wolfenstein 3-D v1.1+',
			],
			glob: [
				'gamemaps.*',
			],
		};

		return md;
	}

	// TODO: Replace this so the various combinations of RLEW/Carmack are separate formats
	static supps(name) {
		return {
			// gamemaps.xxx -> maphead.xxx
			fat: replaceBasename(name, 'maphead'),
			main: replaceBasename(name, 'gamemaps'),
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
				if (i - 38 < 0) {
					return {
						valid: false,
						reason: `Found !ID! header, but at SOF.`,
					};
				}
				buffer.seekAbs(i - 38);
				const levelHeader = buffer.readRecord(recordTypes.gamemaps.levelHeader);
				const levelHeaderPart2 = buffer.readRecord(recordTypes.gamemaps.levelHeaderPart2);
				const expectedPlaneLength = levelHeaderPart2.width * levelHeaderPart2.height * 2;
				debug(levelHeader, levelHeaderPart2);
				if (levelHeader.offPlane0 + 2 + 2 > content.length) {
					return {
						valid: false,
						reason: `Found !ID! header, but plane is too short.`,
					};
				}
				buffer.seekAbs(levelHeader.offPlane0 + 2);
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

	static compress(content, rlewCode) {
		const rlew = super.compress(content, rlewCode);
		const comp = cmp_carmackize.obscure(rlew);

		// Write the original size in the header.
		const buffer = new RecordBuffer(comp.length + 2);
		buffer.write(RecordType.int.u16le, rlew.length);
		buffer.put(comp);

		return buffer.getU8();
	}

	static decompress(content, rlewCode) {
		const buffer = new RecordBuffer(content);
		const lenDecompressed = buffer.read(RecordType.int.u16le);
		// Cut off the decompressed-size field from the start of the file.
		const body = buffer.getU8(2, buffer.length - 2);
		const decomp = cmp_carmackize.reveal(body);
		// Truncate to the decompressed size.
		const trimmed = decomp.slice(0, lenDecompressed);

		return super.decompress(trimmed, rlewCode);
	}
}
