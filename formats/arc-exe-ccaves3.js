/*
 * Crystal Caves Episode 3 .exe file handler.
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

const FORMAT_ID = 'arc-exe-ccaves3';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import FixedArchive from '../util/fixedArchive.js';

export default class Archive_EXE_CCaves3 extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Crystal Caves .exe (episode 3)',
			games: [
				'Crystal Caves (episode 3)',
			],
			glob: [
				'cc3.exe',
			],
		};

		return md;
	}

	static supps() {
		return {
			main: 'cc3.exe',
		};
	}

	// Assumed file is already decompresed, e.g. with gamecomp/decompress_exe().
	static identify(content) {
		if (content.length !== 197664) {
			return {
				valid: false,
				reason: `Unexpected file length.`,
			};
		}

		let buffer = new RecordBuffer(content);
		// Unfortunately no version strings, so check some random message unlikely
		// to be changed.
		buffer.seekAbs(0x2B76F);
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
			{ name: 'e3int.ccl', offset: 0x8F24, diskSize: 41 * 5 },
			{ name: 'e3fin.ccl', diskSize: 41 * 6 },
			{ name: 'e3map.ccl', diskSize: 41 * 25 },
			{ name: 'e3l01.ccl', diskSize: 41 * 24 },
			{ name: 'e3l02.ccl', diskSize: 41 * 21 },
			{ name: 'e3l03.ccl', diskSize: 41 * 24 },
			{ name: 'e3l04.ccl', diskSize: 41 * 23 },
			{ name: 'e3l05.ccl', diskSize: 41 * 24 },
			{ name: 'e3l06.ccl', diskSize: 41 * 24 },
			{ name: 'e3l07.ccl', diskSize: 41 * 24 },
			{ name: 'e3l08.ccl', diskSize: 41 * 24 },
			{ name: 'e3l09.ccl', diskSize: 41 * 23 },
			{ name: 'e3l10.ccl', diskSize: 41 * 24 },
			{ name: 'e3l11.ccl', diskSize: 41 * 23 },
			{ name: 'e3l12.ccl', diskSize: 41 * 24 },
			{ name: 'e3l13.ccl', diskSize: 41 * 24 },
			{ name: 'e3l14.ccl', diskSize: 41 * 23 },
			{ name: 'e3l15.ccl', diskSize: 41 * 21 },
			{ name: 'e3l16.ccl', diskSize: 41 * 24 },
		];
	}
}
