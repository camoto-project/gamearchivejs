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

const FORMAT_ID = 'arc-fixed-keen5_exe';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { cmp_lzexe } from '@camoto/gamecomp';
import ArchiveHandler from '../interface/archiveHandler.js';
import FixedArchive from '../util/fixedArchive.js';

export default class Archive_Fixed_Keen5_EXE extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Commander Keen 5 Executable',
			games: [
				'Commander Keen 5',
			],
			glob: [
				'keen5.exe',
				'keen5c.exe',
				'keen5e.exe',
			],
		};

		// Files can optionally be compressed.
		md.caps.file.attributes.compressed = false;

		return md;
	}

	static identify(content) {
		// UNLZEXE the file if required.
		let output = content;
		if (cmp_lzexe.identify(content).valid) {
			output = cmp_lzexe.reveal(content);
		}

		if (output.length < 0x3355B + 8) {
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

		if (sig(0x3063B, 'TED5.EXE')) return { reason: `Keen 5 CGA (v1.4)`, valid: true };
		if (sig(0x321E6, 'TED5.EXE')) return { reason: `Keen 5 EGA (v1.0)`, valid: true };
		if (sig(0x32FFB, 'TED5.EXE')) return { reason: `Keen 5 EGA (v1.4)`, valid: true };
		if (sig(0x3355B, 'TED5.EXE')) return { reason: `Keen 5 EGA (v1.4g)`, valid: true };

		return {
			valid: false,
			reason: `Not Keen 5 or unknown version.`,
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

			case 'Keen 5 CGA (v1.4)':
				files = [
					{ name: 'audiohed.ck5', offset: 0x21EC0, diskSize: 0x33C  },
					{ name: 'egahead.ck5',  offset: 0x22200, diskSize: 0x39C6 },
					{ name: 'maphead.ck5',  offset: 0x25BD0, diskSize: 0x192 + 0x5C88 },
					{ name: 'audiodct.ck5', offset: 0x36588, diskSize: 0x400  },
					{ name: 'egadict.ck5',  offset: 0x36988, diskSize: 0x400  },
				];
				break;

			case 'Keen 5 EGA (v1.0)':
				files = [
					{ name: 'audiohed.ck5', offset: 0x23A70, diskSize: 0x33C  },
					{ name: 'egahead.ck5',  offset: 0x23DB0, diskSize: 0x39CC },
					{ name: 'maphead.ck5',  offset: 0x27780, diskSize: 0x192 + 0x5C88 },
					{ name: 'audiodct.ck5', offset: 0x37B8A, diskSize: 0x400  },
					{ name: 'egadict.ck5',  offset: 0x37F8A, diskSize: 0x400  },
				];
				break;

			case 'Keen 5 EGA (v1.4)':
				files = [
					{ name: 'audiohed.ck5', offset: 0x24880, diskSize: 0x33C  },
					{ name: 'egahead.ck5',  offset: 0x24BC0, diskSize: 0x39CC },
					{ name: 'maphead.ck5',  offset: 0x28590, diskSize: 0x192 + 0x5C88 },
					{ name: 'audiodct.ck5', offset: 0x38AC4, diskSize: 0x400  },
					{ name: 'egadict.ck5',  offset: 0x38EC4, diskSize: 0x400  },
				];
				break;

			case 'Keen 5 EGA (v1.4g)':
				files = [
					{ name: 'audiohed.ck5', offset: 0x24DE0, diskSize: 0x33C  },
					{ name: 'egahead.ck5',  offset: 0x25120, diskSize: 0x39CC },
					{ name: 'maphead.ck5',  offset: 0x28AF0, diskSize: 0x192 + 0x5C88 },
					{ name: 'audiodct.ck5', offset: 0x39024, diskSize: 0x400  },
					{ name: 'egadict.ck5',  offset: 0x39424, diskSize: 0x400  },
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
