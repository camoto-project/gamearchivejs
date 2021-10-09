/*
 * Dangerous Dave .exe file handler.
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

const FORMAT_ID = 'arc-exe-ddave';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { cmp_rle_id } from '@camoto/gamecomp';
import ArchiveHandler from '../interface/archiveHandler.js';
import FixedArchive from '../util/fixedArchive.js';

const DDAVE_BLOCK_SIZE = 0xFF00;

function revealDDaveRLE(content) {
	let buffer = new RecordBuffer(content);
	const len = buffer.read(RecordType.int.u32le);

	// Skip the length field we just read and RLE-decode the rest.
	return cmp_rle_id.reveal(buffer.getU8(4), { outputLength: len });
}

function obscureDDaveRLE(content, file) {
	// Need to ensure RLE codes don't run across 65280-byte boundaries.
	const chunkedRLE = cmp_rle_id.obscure(content, {
		chunkLength: DDAVE_BLOCK_SIZE,
	});

	let buffer = new RecordBuffer(chunkedRLE.length + 4);
	buffer.write(RecordType.int.u32le, content.length); // decompressed size
	buffer.put(chunkedRLE);
	const padding = file.diskSize - buffer.length;
	if (padding < 0) {
		throw new Error(`File "${file.name}" is too big to fit back into the `
			+ `game .exe file.  It is ${buffer.length} bytes long, but there are `
			+ `only ${file.diskSize} bytes available.  Since the format is `
			+ `compressed, you can increase the compression and thus reduce the `
			+ `file size by having longer horizontal runs of the same colour `
			+ `pixels within each tile.  Note that all graphics for the same device `
			+ `(CGA, EGA or VGA) share the same space, so you can remove detail from `
			+ `other less important or unused images to free up more space, it `
			+ `doesn't have to be the image you just tried to import that needs `
			+ `detail removed.`
		);
	}
	if (padding > 0) {
		debug(`Padding ${file.name} with ${padding} bytes`);
		// Pad the file up to the available space in the .exe, otherwise
		// FixedArchive complains that the file size doesn't match.
		buffer.write(RecordType.padding(padding));
	}
	return buffer.getU8();
}

export default class Archive_EXE_DDave extends ArchiveHandler
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

		return md;
	}

	static supps() {
		return {
			main: 'dave.exe',
		};
	}

	// Assumed file is already decompresed, e.g. with gamecomp/decompress_exe().
	static identify(content) {
		if (content.length < 0x26A80 + 25) {
			return {
				valid: false,
				reason: `File too short.`,
			};
		}

		let buffer = new RecordBuffer(content);
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

	// Assumed file is already decompresed, e.g. with gamecomp/decompress_exe().
	static parse(content) {
		let buffer = new RecordBuffer(content.main);
		buffer.seekAbs(0x0c620);
		const lenCGA = buffer.read(RecordType.int.u32le);
		buffer.seekAbs(0x120f0);
		const lenVGA = buffer.read(RecordType.int.u32le);

		const files = this.fileList({ lenCGA, lenVGA });

		return FixedArchive.parse(content.main, files);
	}

	static generate(archive)
	{
		const files = this.fileList();

		const maxDecompressedSizes = {
			'vgadave.dav': 0x16000,
		};

		for (const [ filename, maxSize ] of Object.entries(maxDecompressedSizes)) {
			const file = files.find(f => f.name === filename);
			if (!file) continue;
			if (file.nativeSize > maxSize) {
				throw new Error(`${file.name} is ${file.nativeSize} bytes in length `
					+ `(before compression), however the maximum supported by the game `
					+ `is ${maxSize} bytes.  You will need to reduce the uncompressed `
					+ `size of your graphics by reducing the number of pixels, e.g. by `
					+ `making some image dimensions smaller.`);
			}
		}

		return {
			main: FixedArchive.generate(archive, files),
		};
	}

	static fileList(sizes = {}) {
		let files = [
			{
				name: 'unk.dav',
				offset: 0x0b510,
				diskSize: 0x0c620 - 0x0b510,
			}, {
				name: 'cgadave.dav',
				offset: 0x0c620,
				diskSize: 0x120f0 - 0x0c620,
				nativeSize: sizes.lenCGA || (0x120f0 - 0x0c620),
				reveal: revealDDaveRLE,
				obscure: obscureDDaveRLE,
				compressed: true,
			}, {
				name: 'vgadave.dav',
				offset: 0x120f0,
				diskSize: 0x1c4e0 - 0x120f0,
				nativeSize: sizes.lenVGA || (0x1c4e0 - 0x120f0),
				reveal: revealDDaveRLE,
				obscure: obscureDDaveRLE,
				compressed: true,
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
				name: 'enemy01.dav',
				offset: 0x25b66 + 80 * 0,
				diskSize: 80,
			}, {
				name: 'enemy02.dav',
				offset: 0x25b66 + 80 * 1,
				diskSize: 80,
			}, {
				name: 'enemy03.dav',
				offset: 0x25b66 + 80 * 2,
				diskSize: 80,
			}, {
				name: 'enemy04.dav',
				offset: 0x25b66 + 80 * 3,
				diskSize: 80,
			}, {
				name: 'enemy05.dav',
				offset: 0x25b66 + 80 * 4,
				diskSize: 80,
			}, {
				name: 'enemy06.dav',
				offset: 0x25b66 + 80 * 5,
				diskSize: 80,
			}, {
				name: 'enemy07.dav',
				offset: 0x25b66 + 80 * 6,
				diskSize: 80,
			}, {
				name: 'enemy08.dav',
				offset: 0x25b66 + 80 * 7,
				diskSize: 80,
			}, {
				name: 'enemy09.dav',
				offset: 0x25b66 + 80 * 8,
				diskSize: 80,
			}, {
				name: 'enemy10.dav',
				offset: 0x25b66 + 80 * 9,
				diskSize: 80,
			}, {
				name: 'levelt.dav',
				offset: 0x25ea4,
				diskSize: 10 * 7,
			}, {
				name: 'randbase.bin',
				offset: 0x26a26,
				diskSize: 17 * 2,
			}, {
				name: 'border.raw',
				offset: 0x26ae9,
				diskSize: 0x26b0a - 0x26ae9,
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

		return files;
	}
}
