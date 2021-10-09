/*
 * Doofus .exe file handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/Doofus
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

const FORMAT_ID = 'arc-exe-doofus';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import FixedArchive from '../util/fixedArchive.js';

export default class Archive_EXE_Doofus extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Doofus .exe',
			games: [
				'Doofus',
			],
			glob: [
				'doofus.exe',
			],
		};

		return md;
	}

	static supps() {
		return {
			main: 'doofus.exe',
		};
	}

	// Assumed file is already decompresed, e.g. with gamecomp/decompress_exe().
	static identify(content) {
		if (content.length < 0xFB10 + 25) {
			return {
				valid: false,
				reason: `File too short.`,
			};
		}

		let buffer = new RecordBuffer(content);
		// This offset is what gamecomp.js comes out with, which is different to
		// unpklite, as unpklite adds extra padding.  Since PKLite -x doesn't add
		// this extra padding, gamecomp.js doesn't either, so we go with that
		// offset.
		buffer.seekAbs(0xFB10);
		//buffer.seekAbs(0xFB70); // unpklite
		const sig = RecordType.string.fixed.noTerm(25).read(buffer);
		if (sig !== 'The Bone Shaker Architect') {
			return {
				valid: false,
				reason: `Wrong signature ${sig}.`,
			};
		}

		return {
			valid: true,
			reason: `Signature matched.`,
		};
	}

	// Assumed file is already decompresed, e.g. with gamecomp/decompress_exe().
	static parse(content) {
		const files = this.fileList();

		return FixedArchive.parse(content.main, files);
	}

	static generate(archive)
	{
		const files = this.fileList();

		return {
			main: FixedArchive.generate(archive, files),
		};
	}

	static fileList() {
		return [
			{
				name: 'gamedata.fat',
				offset: 0x15372,
				//offset: 0x153D2, // pkunlite
				diskSize: 65 * 8,
			},
		];
	}
}
