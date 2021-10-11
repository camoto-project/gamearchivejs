/*
 * Hocus Pocus .exe file handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/Hocus_Pocus
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

const FORMAT_ID = 'arc-exe-hocus';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import FixedArchive from '../util/fixedArchive.js';

class Archive_EXE_Hocus extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Hocus Pocus .exe',
			games: [
				'Hocus Pocus',
			],
			glob: [
				'hocus.exe',
			],
		};

		return md;
	}

	static supps() {
		return {
			main: 'hocus.exe',
		};
	}

	static identify(content) {
		if (content.length < 0x21DD7 + 23) {
			return {
				valid: false,
				reason: `File too short.`,
			};
		}

		let buffer = new RecordBuffer(content);

		const { offset, sig } = this.signature();

		buffer.seekAbs(offset);
		const actualSig = RecordType.string.fixed.noTerm(sig.length).read(buffer);
		if (actualSig !== sig) {
			return {
				valid: false,
				reason: `Signature did not match.`,
			};
		}

		return {
			valid: true,
			reason: `Signature matched.`,
		};
	}

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
}

export class Archive_EXE_Hocus_Beta extends Archive_EXE_Hocus
{
	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID + '-beta',
			title: 'Hocus Pocus Beta .exe',
		};
	}

	static signature() {
		return {
			offset: 0x1B6D4,
			sig: 'HOCUS.DAT',
		};
	}

	static fileList() {
		return [
			{
				name: 'hocus.fat',
				offset: 0x1AD74,
				diskSize: 236 * 8,
			},
		];
	}
}

export class Archive_EXE_Hocus_SW10 extends Archive_EXE_Hocus
{
	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID + '-sw1.0',
			title: 'Hocus Pocus SW1.0 .exe',
		};
	}

	static signature() {
		return {
			offset: 0x20E03,
			sig: 'HOCUS POCUS Version 1.0',
		};
	}

	static fileList() {
		return [
			{
				name: 'hocus.fat',
				offset: 0x1EE04,
				diskSize: 252 * 8,
			},
		];
	}
}

export class Archive_EXE_Hocus_SW11 extends Archive_EXE_Hocus
{
	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID + '-sw1.1',
			title: 'Hocus Pocus SW1.1 .exe',
		};
	}

	static signature() {
		return {
			offset: 0x210F9,
			sig: 'HOCUS POCUS Version 1.1',
		};
	}

	static fileList() {
		return [
			{
				name: 'hocus.fat',
				offset: 0x1F0E4,
				diskSize: 253 * 8,
			},
		];
	}
}

export class Archive_EXE_Hocus_REG10 extends Archive_EXE_Hocus
{
	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID + '-reg1.0',
			title: 'Hocus Pocus REG1.0 .exe',
		};
	}

	static signature() {
		return {
			offset: 0x21AD1,
			sig: 'HOCUS POCUS Version 1.0',
		};
	}

	static fileList() {
		return [
			{
				name: 'hocus.fat',
				offset: 0x1EEB4,
				diskSize: 651 * 8,
			},
		];
	}
}

export class Archive_EXE_Hocus_REG11 extends Archive_EXE_Hocus
{
	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID + '-reg1.1',
			title: 'Hocus Pocus REG1.1 .exe',
		};
	}

	static signature() {
		return {
			offset: 0x21DD7,
			sig: 'HOCUS POCUS Version 1.1',
		};
	}

	static fileList() {
		return [
			{
				name: 'hocus.fat',
				offset: 0x1F1A4,
				diskSize: 652 * 8,
			},
		];
	}
}
