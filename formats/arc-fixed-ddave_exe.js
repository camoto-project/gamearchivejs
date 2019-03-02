/**
 * @file Dangerous Dave .exe file handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/Dangerous_Dave
 *
 * Copyright (C) 2018-2019 Adam Nielsen <malvineous@shikadi.net>
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

const { RecordBuffer, RecordType } = require('@malvineous/record-io-buffer');

const ArchiveHandler = require('./archiveHandler.js');
const FixedArchive = require('../util/fixedArchive.js');
const Debug = require('../util/utl-debug.js');

const FORMAT_ID = 'arc-fixed-ddave_exe';

module.exports = class Archive_Fixed_DDave_EXE extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Dangerous Dave .exe',
			games: [
				'Dangerous Dave',
			],
			glob: [
				'dave.exe',
			],
		};

		// Files can optionally be compressed.
		md.caps.file.attributes.compressed = true;

		return md;
	}

	static identify(content) {
		try {
			Debug.push(FORMAT_ID, 'identify');

			// First, see if the .exe is compressed and decompress it if so.
			if (content.length === 76586) {
				let buffer = new RecordBuffer(content);
				buffer.seekAbs(0x1C);
				const sig = RecordType.string.fixed.noTerm(4).read(buffer);
				if (sig === 'LZ91') {
					Debug.log(`TODO: unlzexe this file automatically`);
					return false;
				}
			}

			// Now examine the decompressed file.
			if (content.length === 172848) {
				let buffer = new RecordBuffer(content);
				buffer.seekAbs(0x26A80);

				const sig = RecordType.string.fixed.noTerm(25).read(buffer);
				if (sig !== 'Trouble loading tileset!$') {
					Debug.log(`Wrong signature => false`);
					return false;
				}
			} else {
				Debug.log(`Unknown file size => false`);
				return false;
			}

			return true;

		} finally {
			Debug.pop();
		}
	}

	static parse(content) {
		let files = [
			{
				name: 'cgadave.dav',
				offset: 0x0c620,
				diskSize: 0x120f0 - 0x0c620,
				filter: 'rle-ddave',
			}, {
				name: 'vgadave.dav',
				offset: 0x120f0,
				diskSize: 0x1c4e0 - 0x120f0,
				filter: 'rle-ddave',
			}, {
				name: 'sounds.spk',
				offset: 0x1c4e0,
				diskSize: 0x1d780 - 0x1c4e0,
			}, {
				name: 'menucga.gfx',
				offset: 0x1d780,
				diskSize: 0x1ea40 - 0x1d780,
			}, {
				name: 'menuega.gfx',
				offset: 0x1ea40,
				diskSize: 0x20ec0 - 0x1ea40,
			}, {
				name: 'menuvga.gfx',
				offset: 0x20ec0,
				diskSize: 0x256c0 - 0x20ec0,
			}, {
				name: 'vga.pal',
				offset: 0x26b0a,
				diskSize: 768,
			},
		];

		// Number of bytes in each level file.
		const lenLevel = 256 + 100*10 + 24;

		for (let i = 0; i < 10; i++) {
			const num = ((i + 1) < 10 ? '0' : '') + (i + 1).toString();
			files.push({
				name: `level${num}.dav`,
				offset: 0x26e0a + lenLevel * i,
				diskSize: lenLevel,
			});
		}

		return FixedArchive.parse(content.main, files);
	}

	static generate(archive)
	{
		return {
			main: FixedArchive.generate(archive),
		};
	}

};
