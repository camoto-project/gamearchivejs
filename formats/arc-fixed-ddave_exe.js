/**
 * @file Dangerous Dave .exe file handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/Dangerous_Dave
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

const FORMAT_ID = 'arc-fixed-ddave_exe';

const { RecordBuffer, RecordType } = require('@camoto/record-io-buffer');
const cmp_lzexe = require('@camoto/gamecomp/compress/cmp-lzexe.js');

const ArchiveHandler = require('./archiveHandler.js');
const FixedArchive = require('../util/fixedArchive.js');
const Debug = require('../util/utl-debug.js');
const g_debug = Debug.extend(FORMAT_ID);

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
		const debug = g_debug.extend('identify');

		// UNLZEXE the file if required.
		let output = content;
		if (cmp_lzexe.identify(content).valid) {
			output = cmp_lzexe.reveal(content);
		}

		if (output.length < 0x26A80 + 25) {
			return {
				valid: false,
				reason: `File too short.`,
			};
		}

		let buffer = new RecordBuffer(output);
		buffer.seekAbs(0x26A80);
		const sig = RecordType.string.fixed.noTerm(25).read(buffer);
		if (sig !== 'Trouble loading tileset!$') {
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

		// UNLZEXE the file if required.
		let decomp = content.main;
		if (cmp_lzexe.identify(content.main).valid) {
			decomp = cmp_lzexe.reveal(content.main);
		}

		return FixedArchive.parse(decomp, files);
	}

	static generate(archive)
	{
		return {
			main: FixedArchive.generate(archive),
		};
	}

};
