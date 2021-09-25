/*
 * Vinyl Goddess From Mars .LBR format handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/LBR_Format
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

const FORMAT_ID = 'arc-lbr-vinyl';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ArchiveHandler from '../interface/archiveHandler.js';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';
import { replaceExtension } from '../util/supp.js';

const knownFilenames = [
	'1000P.CMP',
	'100P.CMP',
	'250P.CMP',
	'500P.CMP',
	'50P.CMP',
	'APPLE.CMP',
	'APPLE.SND',
	'BAMBOOP.CMP',
	'BAPPLE0.OMP',
	'BETA.BIN',
	'BGRENSHT.CMP',
	'BLOOK.CMP',
	'BLUEBALL.CMP',
	'BLUEKEY.CMP',
	'BLUE.PAL',
	'BLUE.TLS',
	'BOTTLE.CMP',
	'BOUNCE.CMP',
	'BRAIN.CMP',
	'BREATH.CMP',
	'BRIDGE.CMP',
	'BSHOT.CMP',
	'BUTFLY.CMP',
	'CANNON.CMP',
	'CASPLAT1.CMP',
	'CASPLAT2.CMP',
	'CASPLAT3.CMP',
	'CASPLAT4.CMP',
	'CASTLE.PAL',
	'CASTLE.TLS',
	'COVERUP.MUS',
	'CREDITS.PAL',
	'CREDITS.SCR',
	'CRUSH.MUS',
	'CSTARS.CMP',
	'DATA.DAT',
	'DARKBAR2.GRA',
	'DEATH.CMP',
	'DEMO_1.DTA',
	'DEMO_2.DTA',
	'DEMO_3.DTA',
	'DIFFBUTN.CMP',
	'DIFFMENU.CMP',
	'DOTS1.CMP',
	'DUNGEON.PAL',
	'DUNGEON.TLS',
	'DUNPLAT1.CMP',
	'DUSTCLUD.CMP',
	'ECHOT1.CMP',
	'EGYPPLAT.CMP',
	'EGYPT.PAL',
	'EGYPT.TLS',
	'ENDBOSSW.CMP',
	'ENDING.SCN',
	'ENTER2.SND',
	'EPISODE.PAL',
	'EPISODE.SCR',
	'EVILEYE.MUS',
	'EXIT.CMP',
	'EXPL1.SND',
	'FEVER.MUS',
	'FIRE231.CMP',
	'FRUIT.SND',
	'GAME1.PAL',
	'GAMEOPT.GRA',
	'GATEKEY.CMP',
	'GOLDKEY.CMP',
	'GRAVE.PAL',
	'GRAVE.TLS',
	'GREYKEY.CMP',
	'GRID.DTA',
	'HARDHEAD.CMP',
	'HEALJUG.CMP',
	'HEALPOT.CMP',
	'HEALPOTD.CMP',
	'HEALPOT.SND',
	'HELLO.T',
	'HORUS.MUS',
	'HURT.SND',
	'HUTS.PAL',
	'HUTS.TLS',
	'INBET.PAL',
	'INBETW.SCR',
	'INOUTP00.CMP',
	'INSURED.MUS',
	'INTRO.MUS',
	'JFIREB.CMP',
	'JILL.CMP',
	'JILLEXPB.CMP',
	'JILLEXP.CMP',
	'JILLFIRE.CMP',
	'JILL.SPR',
	'JUNGLE2.FON',
	'JUNGLE.FON',
	'KNIFE.CMP',
	'LAND.SND',
	'LC_CAPS.RAW',
	'LC_NUMS.RAW',
	'LEVEL1-1.M',
	'LEVEL1-2.M',
	'LEVEL1-3.M',
	'LEVEL1-4.M',
	'LEVEL1-5.M',
	'LEVEL1-6.M',
	'LEVEL1-7.M',
	'LEVEL1-8.M',
	'LEVEL1-9.M',
	'LEVEL2-1.M',
	'LEVEL2-2.M',
	'LEVEL2-3.M',
	'LEVEL2-4.M',
	'LEVEL2-5.M',
	'LEVEL2-6.M',
	'LEVEL2-7.M',
	'LEVEL2-8.M',
	'LEVEL2-9.M',
	'LEVEL3-1.M',
	'LEVEL3-2.M',
	'LEVEL3-3.M',
	'LEVEL3-4.M',
	'LEVEL3-5.M',
	'LEVEL3-6.M',
	'LEVEL3-7.M',
	'LEVEL3-8.M',
	'LEVEL3-9.M',
	'LGRENSHT.CMP',
	'LITSCROL.CMP',
	'MAINFONT.GRA',
	'MANEATPL.CMP',
	'MENU2.RAW',
	'MENUCH.GRA',
	'MENUCLIK.SND',
	'MENU.RAW',
	'MENUYSNO.GRA',
	'MIDLEVEL.CMP',
	'MIDPOST.SND',
	'MMREST.GRA',
	'MONDIE.SND',
	'MOUNT.TLS',
	'MPLAT211.CMP',
	'MPLAT212.CMP',
	'MPLAT221.CMP',
	'MPLAT311.CMP',
	'MPLAT331.CMP',
	'MPLAT332.CMP',
	'MUSHSHOT.CMP',
	'MYSTIC.MUS',
	'NEWBEH.CMP',
	'OLDBEH.CMP',
	'ORDER.RES',
	'OSIRIS.MUS',
	'OUTGATE.CMP',
	'OVERHEAD.PAL',
	'OVERHEAD.TLS',
	'OVERHED1.MAP',
	'OVERHED2.MAP',
	'OVERHED3.MAP',
	'PAN2.SND',
	'PRESENT.GRA',
	'PRESENT.PAL',
	'PROWLER.MUS',
	'PURPLE.PAL',
	'PURPLE.TLS',
	'PUZZ6.MUS',
	'RABBIT.CMP',
	'RABBITD.CMP',
	'REDKEY.CMP',
	'RETROJIL.MUS',
	'RING.CMP',
	'RUFEYE.CMP',
	'RUFEYES.CMP',
	'RUFEYSE.CMP',
	'SAVEBOXG.GRA',
	'SAVEBOXO.GRA',
	'SCORE.CMP',
	'SCROLLG.CMP',
	'SCROLLO.CMP',
	'SGREENE.CMP',
	'SHOTEXPL.CMP',
	'SHOTTEST.CMP',
	'SHWRREM.GRA',
	'SIXPS.GRA',
	'SIXPS.PAL',
	'SKELBONE.CMP',
	'SKELETON.CMP',
	'SKELETON.SND',
	'SKELFLY.CMP',
	'SMALLEX.CMP',
	'SMALNUM.CMP',
	'SPARE.SCR',
	'SPIKEBA.CMP',
	'SPLADY.CMP',
	'SPLAT211.CMP',
	'SPLAT223.CMP',
	'SPLAT231.CMP',
	'SPRING.SND',
	'SPROIN.CMP',
	'SQUARE.TLS',
	'STAR.CMP',
	'STARDUST.MUS',
	'STHORNSH.CMP',
	'STICKEYE.CMP',
	'STIKHORN.CMP',
	'STLSPIKE.CMP',
	'STORY.PAL',
	'STORY.SCR',
	'STRIKE.MUS',
	'STRYFNT1.GRA',
	'SVINYL.SPR',
	'TAFA.MUS',
	'T.CMP',
	'TEST0004.CMP',
	'THROW.SND',
	'TITLE.PAL',
	'TITLE.SCR',
	'TORNADO.CMP',
	'TRAMPLE.MUS',
	'TREEMPLA.CMP',
	'TREES.PAL',
	'TREES.TLS',
	'TWILIGHT.MUS',
	'UGH.CMP',
	'UNLOGIC1.GRA',
	'UNLOGIC1.PAL',
	'UNLOGIC.UNM',
	'VINE.CMP',
	'VINYLDIE.SND',
	'VINYL.GRA',
	'VINYL.PAL',
	'VINYL.SPR',
	'VSMALLE.CMP',
	'WEAPBLNK.OMP',
	'WEAPBLUE.OMP',
	'WEAPBOTL.OMP',
	'WEAPFIRE.OMP',
	'WEAPFSKF.OMP',
	'WEAPSLKF.OMP',
	'WEAPSTAR.OMP',
	'WFIREB.CMP',
	'WOODSPIK.CMP',
	'XHUTS.PAL',
	'YELLOW.PAL',
	'YELLOW.TLS',
	'YES.CMP',

	// These names were guessed by looking at others
	'ENDG1.PAL',
	'ENDG1.SCR',
	'ENDG2.PAL',
	'ENDG2.SCR',
	'ENDG3.PAL',
	'ENDG3.SCR',
	'MOUNT.PAL',
	'JUNGLE3.FON',

	// These names were brute-forced from the hashes against a dictionary, so they
	// could be wrong (each hash matches about 56 billion different filenames...)
	'BEGIN.PAL',    // Also ARCHIL.PAL.   Before Bl, so probably correct.
	'P.PAL',        // Also SANGGIL.PAL.  Between O-P, maybe correct.
	'HDICFONT.GRA', // probably wrong
	'KOEWA.SND',    // almost certainly wrong, also JADEJM.SND
	'PALET1.PAL',
	'QTYFONT.GRA',
	'SHWFFONT.GRA',
	'ROLPC.TIM',    // brute forced, but correct because...
	'ROLPC.MUS',    // ...there's a matching song name too

	// These names were guessed from the music filenames but with a different
	// extension for the instruments.
	'COVERUP.TIM',
	'CRUSH.TIM',
	'EVILEYE.TIM',
	'FEVER.TIM',
	'HORUS.TIM',
	'INSURED.TIM',
	'INTRO.TIM',
	'MYSTIC.TIM',
	'OSIRIS.TIM',
	'PROWLER.TIM',
	'PUZZ6.TIM',
	'RETROJIL.TIM',
	'STARDUST.TIM',
	'STRIKE.TIM',
	'TAFA.TIM',
	'TRAMPLE.TIM',
	'TWILIGHT.TIM',

	// These were guessed by lemm
	'BAPPLE1.OMP',
	'BAPPLE2.OMP',
	'BAPPLE3.OMP',
	'BAPPLE4.OMP',

	// These were guessed by wiivn
	'SWOOSH.SND',
	'TEXTBOX.GRA',
	'TEXTBOX2.GRA',

	// Files used by test code
	'ONE.TXT',
	'TWO.TXT',
	'THREE.TXT',
	'FOUR.TXT',
	'TEST1',
	'TEST2',
];

const recordTypes = {
	header: {
		fileCount: RecordType.int.u16le,
	},
	fatEntry: {
		hash: RecordType.int.u16le,
		offset: RecordType.int.u32le,
	},
};

const HEADER_LEN = 2; // sizeof(header)
const FATENTRY_LEN = 6; // sizeof(fatEntry)

export default class Archive_LBR_Vinyl extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'LBR File',
			games: [
				'Vinyl Goddess From Mars',
			],
			glob: [
				'*.lbr',
			],
		};

		return md;
	}

	static supps(filename) {
		return {
			main: replaceExtension(filename, 'lbr'),
		};
	}

	static identify(content) {
		const lenArchive = content.length;

		if (lenArchive < HEADER_LEN) {
			return {
				valid: false,
				reason: `Content too short (< ${HEADER_LEN} b).`,
			};
		}

		let buffer = new RecordBuffer(content);
		const header = buffer.readRecord(recordTypes.header);

		const lenFAT = HEADER_LEN + header.fileCount * FATENTRY_LEN;
		if (lenArchive < lenFAT) {
			return {
				valid: false,
				reason: `Content too short (< ${lenFAT} b).`,
			};
		}

		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			if (fatEntry.offset >= lenArchive) {
				return {
					valid: false,
					reason: `File offset (${fatEntry.offset}) is past the end of the `
						+ `archive (${lenArchive}).`,
				};
			}
		}

		if ((header.fileCount === 0) && (lenArchive !== 2)) {
			return {
				valid: false,
				reason: `Empty archive can't have data.`,
			};
		}

		return {
			valid: true,
			reason: `Header OK.`,
		};
	}

	static parse({main: content}) {
		let archive = new Archive();
		let buffer = new RecordBuffer(content);

		// Precalculate the hashes of known filenames
		let hashes = {};
		for (const name of knownFilenames) {
			const h = this.calcHash(name);
			hashes[h] = name;
		}

		const header = buffer.readRecord(recordTypes.header);

		let lastFile;

		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);

			let file = new File();
			file.name = hashes[fatEntry.hash];
			file.offset = fatEntry.offset;
			file.getRaw = () => buffer.getU8(file.offset, file.diskSize);
			file.attributes.compressed = false;
			file.attributes.encrypted = false;

			if (!file.name) {
				file.name = 'unknown-' + fatEntry.hash;
			}

			archive.files.push(file);

			if (lastFile) {
				lastFile.diskSize = lastFile.nativeSize = fatEntry.offset - lastFile.offset;
			}
			lastFile = file;
		}
		if (lastFile) {
			lastFile.diskSize = lastFile.nativeSize = content.length - lastFile.offset;
		}

		return archive;
	}

	static generate(archive)
	{
		const header = {
			fileCount: archive.files.length,
		};

		// Work out where the FAT ends and the first file starts.
		const lenFAT = HEADER_LEN + FATENTRY_LEN * header.fileCount;

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			lenFAT,
		);

		let buffer = new RecordBuffer(finalSize);
		buffer.writeRecord(recordTypes.header, header);

		let offset = lenFAT;
		for (const file of archive.files) {
			const entry = {
				hash: this.calcHash(file.name),
				offset: offset,
			};
			buffer.writeRecord(recordTypes.fatEntry, entry);
			offset += file.nativeSize;
		}

		for (const file of archive.files) {
			const content = file.getContent();

			// Safety check.
			if (content.length != file.nativeSize) {
				throw new Error(`Length of data (${content.length}) and nativeSize `
					+ `(${file.nativeSize}) field do not match for ${file.name}!`);
			}

			buffer.put(content);
		}

		return {
			main: buffer.getU8(),
		};
	}

	/// Hash function to convert filenames into LBR hashes.
	static calcHash(content)
	{
		let hash = 0;
		for (let i = 0; i < content.length; i++) {
			hash ^= content.charCodeAt(i) << 8;
			for (let j = 0; j < 8; j++) {
				hash <<= 1;
				if (hash & 0x10000) hash ^= 0x1021;
			}
		}
		return hash & 0xffff;
	}
}
