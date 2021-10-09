/*
 * Commander Keen 5 .exe file handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/Commander_Keen_4-6
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

const FORMAT_ID = 'arc-exe-keen5';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import FixedArchive from '../util/fixedArchive.js';
import { replaceExtension } from '../util/supp.js';

class Archive_EXE_Keen5 extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID + '-' + this.getVersion().code,
			title: `Commander Keen 5 ${this.getVersion().name} executable`,
			games: [
				'Commander Keen 5',
			],
			glob: [
				'keen5.exe',
				'keen5c.exe',
				'keen5e.exe',
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
		if (content.length < 0x3355B + 8) {
			return {
				valid: false,
				reason: `File too short.`,
			};
		}

		let buffer = new RecordBuffer(content);

		const sig = this.getSignature();
		buffer.seekAbs(sig.offset);
		const act = RecordType.string.fixed.noTerm(sig.content.length).read(buffer);
		if (act === sig.content) {
			return {
				valid: true,
				reason: 'Signature matched',
			};
		}

		return {
			valid: false,
			reason: `Signature for Keen 5 ${this.getVersion().name} did not match.`,
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
}

export class Archive_EXE_Keen5_CGA_1v4 extends Archive_EXE_Keen5
{
	static getVersion() {
		return {
			code: 'cga_1v4',
			name: 'CGA (v1.4)',
		};
	}

	static getSignature() {
		return {
			offset: 0x3063B,
			content: 'TED5.EXE',
		};
	}

	static fileList() {
		return [
			{ name: 'audiohed.ck5', offset: 0x21EC0, diskSize: 0x33C  },
			{ name: 'cgahead.ck5',  offset: 0x22200, diskSize: 0x39C6 },
			{ name: 'maphead.ck5',  offset: 0x25BD0, diskSize: 0x192 + 0x5C88 },
			{ name: 'audiodct.ck5', offset: 0x36588, diskSize: 0x400  },
			{ name: 'cgadict.ck5',  offset: 0x36988, diskSize: 0x400  },
		];
	}
}

export class Archive_EXE_Keen5_EGA_1v0 extends Archive_EXE_Keen5
{
	static getVersion() {
		return {
			code: 'ega_1v0',
			name: 'EGA (v1.0)',
		};
	}

	static getSignature() {
		return {
			offset: 0x321E6,
			content: 'TED5.EXE',
		};
	}

	static fileList() {
		return [
			{ name: 'audiohed.ck5', offset: 0x23A70, diskSize: 0x33C  },
			{ name: 'egahead.ck5',  offset: 0x23DB0, diskSize: 0x39CC },
			{ name: 'maphead.ck5',  offset: 0x27780, diskSize: 0x192 + 0x5C88 },
			{ name: 'audiodct.ck5', offset: 0x37B8A, diskSize: 0x400  },
			{ name: 'egadict.ck5',  offset: 0x37F8A, diskSize: 0x400  },
		];
	}
}

export class Archive_EXE_Keen5_EGA_1v4 extends Archive_EXE_Keen5
{
	static getVersion() {
		return {
			code: 'ega_1v4',
			name: 'EGA (v1.4)',
		};
	}

	static getSignature() {
		return {
			offset: 0x32FFB,
			content: 'TED5.EXE',
		};
	}

	static fileList() {
		return [
			{ name: 'audiohed.ck5', offset: 0x24880, diskSize: 0x33C  },
			{ name: 'egahead.ck5',  offset: 0x24BC0, diskSize: 0x39CC },
			{ name: 'maphead.ck5',  offset: 0x28590, diskSize: 0x192 + 0x5C88 },
			{ name: 'audiodct.ck5', offset: 0x38AC4, diskSize: 0x400  },
			{ name: 'egadict.ck5',  offset: 0x38EC4, diskSize: 0x400  },
		];
	}
}

export class Archive_EXE_Keen5_EGA_1v4g extends Archive_EXE_Keen5
{
	static getVersion() {
		return {
			code: 'ega_1v4g',
			name: 'EGA (v1.4g)',
		};
	}

	static getSignature() {
		return {
			offset: 0x3355B,
			content: 'TED5.EXE',
		};
	}

	static fileList() {
		return [
			{ name: 'audiohed.ck5', offset: 0x24DE0, diskSize: 0x33C  },
			{ name: 'egahead.ck5',  offset: 0x25120, diskSize: 0x39CC },
			{ name: 'maphead.ck5',  offset: 0x28AF0, diskSize: 0x192 + 0x5C88 },
			{ name: 'audiodct.ck5', offset: 0x39024, diskSize: 0x400  },
			{ name: 'egadict.ck5',  offset: 0x39424, diskSize: 0x400  },
		];
	}
}
