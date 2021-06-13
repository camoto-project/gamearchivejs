/*
 * Commander Keen 4 .exe file handler.
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

const FORMAT_ID = 'arc-exe-keen4';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { cmp_lzexe } from '@camoto/gamecomp';
import ArchiveHandler from '../interface/archiveHandler.js';
import FixedArchive from '../util/fixedArchive.js';
import { replaceExtension } from '../util/supp.js';

class Archive_EXE_Keen4 extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID + '-' + this.getVersion().code,
			title: `Commander Keen 4 ${this.getVersion().name} executable`,
			games: [
				'Commander Keen 4',
			],
			glob: [
				'keen.exe',
				'keen4.exe',
				'keen4c.exe',
				'keen4e.exe',
			],
		};

		// Files can optionally be compressed.
		md.caps.file.attributes.compressed = false;

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'exe'),
		};
	}

	static identify(content) {
		// UNLZEXE the file if required.
		let output = content;
		if (cmp_lzexe.identify(content).valid) {
			output = cmp_lzexe.reveal(content);
		}
		// Early versions use PKLITE instead.
		/*
		if (cmp_pklite.identify(content).valid) {
			output = cmp_pklite.reveal(content);
		}
		*/

		if (output.length < 0x3220C + 8) {
			return {
				valid: false,
				reason: `File too short.`,
			};
		}

		let buffer = new RecordBuffer(output);

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
			reason: `Signature for Keen 4 ${this.getVersion().name} did not match.`,
		};
	}

	static parse(content) {
		// UNLZEXE the file if required.
		let decomp = content.main;
		if (cmp_lzexe.identify(content.main).valid) {
			decomp = cmp_lzexe.reveal(content.main);
		}

		const files = this.fileList();

		return FixedArchive.parse(decomp, files);
	}

	static generate(archive)
	{
		const files = this.fileList();

		return {
			main: FixedArchive.generate(archive, files),
		};
	}
}

export class Archive_EXE_Keen4_CGA_1v0 extends Archive_EXE_Keen4
{
	static getVersion() {
		return {
			code: 'cga_1v0',
			name: 'CGA (v1.0)',
		};
	}

	static getSignature() {
		return {
			offset: 0x2E4B6,
			content: 'TED5.EXE',
		};
	}

	static fileList() {
		return [
			{ name: 'audiohed.ck4', offset: 0x20390, diskSize: 0x28C  },
			{ name: 'cgahead.ck4',  offset: 0x20620, diskSize: 0x3798 },
			{ name: 'maphead.ck4',  offset: 0x23DC0, diskSize: 0x192 + 0x59DC },
			{ name: 'audiodct.ck4', offset: 0x34DA6, diskSize: 0x400  },
			{ name: 'cgadict.ck4',  offset: 0x351A6, diskSize: 0x400  },
		];
	}
}

export class Archive_EXE_Keen4_CGA_1v1 extends Archive_EXE_Keen4
{
	static getVersion() {
		return {
			code: 'cga_1v1',
			name: 'CGA (v1.1)',
		};
	}

	static getSignature() {
		return {
			offset: 0x2E4C6,
			content: 'TED5.EXE',
		};
	}

	static fileList() {
		return [
			{ name: 'audiohed.ck4', offset: 0x203A0, diskSize: 0x28C  },
			{ name: 'cgahead.ck4',  offset: 0x20630, diskSize: 0x3798 },
			{ name: 'maphead.ck4',  offset: 0x23DD0, diskSize: 0x192 + 0x59DC },
			{ name: 'audiodct.ck4', offset: 0x34DB6, diskSize: 0x400  },
			{ name: 'cgadict.ck4',  offset: 0x351B6, diskSize: 0x400  },
		];
	}
}

export class Archive_EXE_Keen4_CGA_1v4f extends Archive_EXE_Keen4
{
	static getVersion() {
		return {
			code: 'cga_1v4f',
			name: 'CGA (v1.4f)',
		};
	}

	static getSignature() {
		return {
			offset: 0x2F4DC,
			content: 'TED5.EXE',
		};
	}

	static fileList() {
		return [
			{ name: 'audiohed.ck4', offset: 0x213A0, diskSize: 0x28C  },
			{ name: 'cgahead.ck4',  offset: 0x21630, diskSize: 0x37B0 },
			{ name: 'maphead.ck4',  offset: 0x24DE0, diskSize: 0x192 + 0x59DC },
			{ name: 'audiodct.ck4', offset: 0x35F5C, diskSize: 0x400  },
			{ name: 'cgadict.ck4',  offset: 0x3635C, diskSize: 0x400  },
		];
	}
}

export class Archive_EXE_Keen4_EGA_1v0d extends Archive_EXE_Keen4
{
	static getVersion() {
		return {
			code: 'ega_1v0d',
			name: 'EGA (v1.0, demo)',
		};
	}

	static getSignature() {
		return {
			offset: 0x31C22,
			content: 'TED5.EXE',
		};
	}

	static fileList() {
		return [
			// audiohed.ck4 not embedded
			{ name: 'egahead.ck4',  offset: 0x27000, diskSize: 0x495C },
			{ name: 'maphead.ck4',  offset: 0x21490, diskSize: 0x192 + 0x59DC },
			{ name: 'egadict.ck4',  offset: 0x38006, diskSize: 0x400  },
		];
	}
}

export class Archive_EXE_Keen4_EGA_1v0 extends Archive_EXE_Keen4
{
	static getVersion() {
		return {
			code: 'ega_1v0',
			name: 'EGA (v1.0)',
		};
	}

	static getSignature() {
		return {
			offset: 0x30AA6,
			content: 'TED5.EXE',
		};
	}

	static fileList() {
		return [
			{ name: 'audiohed.ck4', offset: 0x22980, diskSize: 0x28C  },
			{ name: 'egahead.ck4',  offset: 0x22C10, diskSize: 0x3798 },
			{ name: 'maphead.ck4',  offset: 0x263B0, diskSize: 0x192 + 0x59DC },
			{ name: 'audiodct.ck4', offset: 0x36DF6, diskSize: 0x400  },
			{ name: 'egadict.ck4',  offset: 0x371F6, diskSize: 0x400  },
		];
	}
}

export class Archive_EXE_Keen4_EGA_1v1 extends Archive_EXE_Keen4
{
	static getVersion() {
		return {
			code: 'ega_1v1',
			name: 'EGA (v1.1)',
		};
	}

	static getSignature() {
		return {
			offset: 0x30E76,
			content: 'TED5.EXE',
		};
	}

	static fileList() {
		return [
			{ name: 'audiohed.ck4', offset: 0x22D50, diskSize: 0x28C  },
			{ name: 'egahead.ck4',  offset: 0x22FE0, diskSize: 0x3798 },
			{ name: 'maphead.ck4',  offset: 0x26780, diskSize: 0x192 + 0x59DC },
			{ name: 'audiodct.ck4', offset: 0x37282, diskSize: 0x400  },
			{ name: 'egadict.ck4',  offset: 0x37682, diskSize: 0x400  },
		];
	}
}

export class Archive_EXE_Keen4_EGA_1v2 extends Archive_EXE_Keen4
{
	static getVersion() {
		return {
			code: 'ega_1v2',
			name: 'EGA (v1.2)',
		};
	}

	static getSignature() {
		return {
			offset: 0x310D6,
			content: 'TED5.EXE',
		};
	}

	static fileList() {
		return [
			{ name: 'audiohed.ck4', offset: 0x22FA0, diskSize: 0x28C  },
			{ name: 'egahead.ck4',  offset: 0x23230, diskSize: 0x37B0 },
			{ name: 'maphead.ck4',  offset: 0x269E0, diskSize: 0x192 + 0x59DC },
			{ name: 'audiodct.ck4', offset: 0x37534, diskSize: 0x400  },
			{ name: 'egadict.ck4',  offset: 0x37934, diskSize: 0x400  },
		];
	}
}

export class Archive_EXE_Keen4_EGA_1v4 extends Archive_EXE_Keen4
{
	static getVersion() {
		return {
			code: 'ega_1v4',
			name: 'EGA (v1.4/v1.4f)',
		};
	}

	static getSignature() {
		return {
			offset: 0x31D2C,
			content: 'TED5.EXE',
		};
	}

	static fileList() {
		return [
			{ name: 'audiohed.ck4', offset: 0x23BF0, diskSize: 0x28C  },
			{ name: 'egahead.ck4',  offset: 0x23E80, diskSize: 0x37B0 },
			{ name: 'maphead.ck4',  offset: 0x27630, diskSize: 0x192 + 0x59DC },
			{ name: 'audiodct.ck4', offset: 0x382F6, diskSize: 0x400  },
			{ name: 'egadict.ck4',  offset: 0x386F6, diskSize: 0x400  },
		];
	}
}

export class Archive_EXE_Keen4_EGA_1v4g extends Archive_EXE_Keen4
{
	static getVersion() {
		return {
			code: 'ega_1v4g',
			name: 'EGA (v1.4g)',
		};
	}

	static getSignature() {
		return {
			offset: 0x3220C,
			content: 'TED5.EXE',
		};
	}

	static fileList() {
		return [
			{ name: 'audiohed.ck4', offset: 0x240D0, diskSize: 0x28C  },
			{ name: 'egahead.ck4',  offset: 0x24360, diskSize: 0x37B0 },
			{ name: 'maphead.ck4',  offset: 0x27B10, diskSize: 0x192 + 0x59DC },
			{ name: 'audiodct.ck4', offset: 0x387D6, diskSize: 0x400  },
			{ name: 'egadict.ck4',  offset: 0x38BD6, diskSize: 0x400  },
		];
	}
}
