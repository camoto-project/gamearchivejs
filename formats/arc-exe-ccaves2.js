/*
 * Crystal Caves Episode 2 .exe file handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/Crystal_Caves
 *
 * Copyright (C) 2010-2022 Adam Nielsen <malvineous@shikadi.net>
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

const FORMAT_ID = 'arc-exe-ccaves2';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import FixedArchive from '../util/fixedArchive.js';

export default class Archive_EXE_CCaves2 extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Crystal Caves .exe (episode 2)',
			games: [
				'Crystal Caves (episode 2)',
			],
			glob: [
				'cc2.exe',
			],
		};

		return md;
	}

	static supps() {
		return {
			main: 'cc2.exe',
		};
	}

	// Assumed file is already decompresed, e.g. with gamecomp/decompress_exe().
	static identify(content) {
		if (content.length !== 190976) {
			return {
				valid: false,
				reason: `Unexpected file length.`,
			};
		}

		let buffer = new RecordBuffer(content);
		// Unfortunately no version strings, so check some random message unlikely
		// to be changed.
		buffer.seekAbs(0x29D48);
		const sig = RecordType.string.fixed.noTerm(12).read(buffer);
		if (sig !== 'EGA/VGA card') {
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
			{ name: 'e2int.ccl', offset: 0x8CE0, diskSize: 41 * 5 },
			{ name: 'e2fin.ccl', diskSize: 41 * 6 },
			{ name: 'e2map.ccl', diskSize: 41 * 25 },
			{ name: 'e2l01.ccl', diskSize: 41 * 24 },
			{ name: 'e2l02.ccl', diskSize: 41 * 25 },
			{ name: 'e2l03.ccl', diskSize: 41 * 24 },
			{ name: 'e2l04.ccl', diskSize: 41 * 23 },
			{ name: 'e2l05.ccl', diskSize: 41 * 23 },
			{ name: 'e2l06.ccl', diskSize: 41 * 24 },
			{ name: 'e2l07.ccl', diskSize: 41 * 24 },
			{ name: 'e2l08.ccl', diskSize: 41 * 23 },
			{ name: 'e2l09.ccl', diskSize: 41 * 23 },
			{ name: 'e2l10.ccl', diskSize: 41 * 24 },
			{ name: 'e2l11.ccl', diskSize: 41 * 24 },
			{ name: 'e2l12.ccl', diskSize: 41 * 24 },
			{ name: 'e2l13.ccl', diskSize: 41 * 24 },
			{ name: 'e2l14.ccl', diskSize: 41 * 23 },
			{ name: 'e2l15.ccl', diskSize: 41 * 23 },
			{ name: 'e2l16.ccl', diskSize: 41 * 23 },
		];
	}
}
