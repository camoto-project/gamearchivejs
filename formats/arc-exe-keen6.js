/*
 * Commander Keen 6 .exe file handler.
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

const FORMAT_ID = 'arc-exe-keen6';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { cmp_lzexe } from '@camoto/gamecomp';
import ArchiveHandler from '../interface/archiveHandler.js';
import FixedArchive from '../util/fixedArchive.js';
import { replaceExtension } from '../util/supp.js';

export default class Archive_EXE_Keen6 extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Commander Keen 6 Executable',
			games: [
				'Commander Keen 6',
			],
			glob: [
				'k6demo.exe',
				'keen6.exe',
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

		if (output.length < 0x339EC + 8) {
			return {
				valid: false,
				reason: `File too short.`,
			};
		}

		let buffer = new RecordBuffer(output);
		const sig = (off, exp) => {
			buffer.seekAbs(off);
			const act = RecordType.string.fixed.noTerm(exp.length).read(buffer);
			return act === exp;
		};

		if (sig(0x300A6, 'TED5.EXE')) return { reason: `Keen 6 CGA (v1.0)`, valid: true };
		if (sig(0x313BC, 'TED5.EXE')) return { reason: `Keen 6 CGA (v1.4)`, valid: true };
		if (sig(0x3112C, 'TED5.EXE')) return { reason: `Keen 6 CGA (v1.5)`, valid: true };
		if (sig(0x2C9A6, 'TED5.EXE')) return { reason: `Keen 6 EGA (v1.0, demo)`, valid: true };
		if (sig(0x2D2D6, 'TED5.EXE')) return { reason: `Keen 6 EGA (v1.0, promo)`, valid: true };
		if (sig(0x325B6, 'TED5.EXE')) return { reason: `Keen 6 EGA (v1.0)`, valid: true };
		if (sig(0x339EC, 'TED5.EXE')) return { reason: `Keen 6 EGA (v1.4)`, valid: true };
		if (sig(0x3364C, 'TED5.EXE')) return { reason: `Keen 6 EGA (v1.5)`, valid: true };

		return {
			valid: false,
			reason: `Not Keen 4 or unknown version.`,
		};
	}

	static parse(content) {
		// UNLZEXE the file if required.
		let decomp = content.main;
		if (cmp_lzexe.identify(content.main).valid) {
			decomp = cmp_lzexe.reveal(content.main);
		}

		const version = this.identify(decomp);
		if (!version.valid) {
			throw new Error(version.reason);
		}

		let files;
		switch (version.reason) {

			case 'Keen 6 CGA (v1.0)':
				files = [
					{ name: 'audiohed.ck6', offset: 0x1FF20, diskSize: 0x2F8  },
					{ name: 'egahead.ck6',  offset: 0x20220, diskSize: 0x4119 },
					{ name: 'maphead.ck6',  offset: 0x24340, diskSize: 0x192 + 0x5D60  },
					{ name: 'audiodct.ck6', offset: 0x365A2, diskSize: 0x400  },
					{ name: 'egadict.ck6',  offset: 0x369A2, diskSize: 0x400  },
				];
				break;

			case 'Keen 6 CGA (v1.4)':
				files = [
					{ name: 'audiohed.ck6', offset: 0x21230, diskSize: 0x2F8  },
					{ name: 'egahead.ck6',  offset: 0x21530, diskSize: 0x4119 },
					{ name: 'maphead.ck6',  offset: 0x25650, diskSize: 0x192 + 0x5D60 },
					{ name: 'audiodct.ck6', offset: 0x37A30, diskSize: 0x400  },
					{ name: 'egadict.ck6',  offset: 0x37E30, diskSize: 0x400  },
				];
				break;

			case 'Keen 6 CGA (v1.5)':
				files = [
					{ name: 'audiohed.ck6', offset: 0x20FA0, diskSize: 0x2F8  },
					{ name: 'egahead.ck6',  offset: 0x212A0, diskSize: 0x4119 },
					{ name: 'maphead.ck6',  offset: 0x253C0, diskSize: 0x192 + 0x5D60 },
					{ name: 'audiodct.ck6', offset: 0x377A0, diskSize: 0x400  },
					{ name: 'egadict.ck6',  offset: 0x37BA0, diskSize: 0x400  },
				];
				break;

			case 'Keen 6 EGA (v1.0, demo)':
				files = [
					{ name: 'audiohed.ck6', offset: 0x1E3E0, diskSize: 0x24C  },
					{ name: 'egahead.ck6',  offset: 0x1E630, diskSize: 0x332A },
					{ name: 'maphead.ck6',  offset: 0x21960, diskSize: 0x192 + 0x4AD0 },
					{ name: 'audiodct.ck6', offset: 0x31A40, diskSize: 0x400  },
					{ name: 'egadict.ck6',  offset: 0x31E40, diskSize: 0x400  },
				];
				break;

			case 'Keen 6 EGA (v1.0, promo)':
				files = [
					{ name: 'audiohed.ck6', offset: 0x1ED10, diskSize: 0x24C  },
					{ name: 'egahead.ck6',  offset: 0x1EF60, diskSize: 0x332A },
					{ name: 'maphead.ck6',  offset: 0x22290, diskSize: 0x192 + 0x4AD0 },
					{ name: 'audiodct.ck6', offset: 0x32316, diskSize: 0x400  },
					{ name: 'egadict.ck6',  offset: 0x32716, diskSize: 0x400  },
				];
				break;

			case 'Keen 6 EGA (v1.0)':
				files = [
					{ name: 'audiohed.ck6', offset: 0x22420, diskSize: 0x2F8  },
					{ name: 'egahead.ck6',  offset: 0x22720, diskSize: 0x412B },
					{ name: 'maphead.ck6',  offset: 0x26850, diskSize: 0x192 + 0x5D60 },
					{ name: 'audiodct.ck6', offset: 0x38512, diskSize: 0x400  },
					{ name: 'egadict.ck6',  offset: 0x38912, diskSize: 0x400  },
				];
				break;

			case 'Keen 6 EGA (v1.4)':
				files = [
					{ name: 'audiohed.ck6', offset: 0x23850, diskSize: 0x2F8  },
					{ name: 'egahead.ck6',  offset: 0x23B50, diskSize: 0x412B },
					{ name: 'maphead.ck6',  offset: 0x27C80, diskSize: 0x192 + 0x5D60 },
					{ name: 'audiodct.ck6', offset: 0x39AEE, diskSize: 0x400  },
					{ name: 'egadict.ck6',  offset: 0x39EEE, diskSize: 0x400  },
				];
				break;

			case 'Keen 6 EGA (v1.5)':
				files = [
					// audiohed.ck6 not embedded
					{ name: 'egahead.ck6',  offset: 0x285B0, diskSize: 0x412B },
					{ name: 'maphead.ck6',  offset: 0x2C6E0, diskSize: 0x192 + 0x5D60 },
					{ name: 'audiodct.ck6', offset: 0x3974E, diskSize: 0x400  },
					{ name: 'egadict.ck6',  offset: 0x39B4E, diskSize: 0x400  },
				];
				break;

			default:
				throw new Error('Unimplemented version: ' + version.reason);
		}

		return FixedArchive.parse(decomp, files);
	}

	static generate(archive)
	{
		return {
			main: FixedArchive.generate(archive),
		};
	}
}
