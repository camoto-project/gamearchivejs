/*
 * Test with files from the actual games.
 *
 * These files cannot be distributed with the code, so these tests are skipped
 * if the files are not present.  You will need to obtain copies of the games
 * and copy the files into their respective test folders in order to run these
 * tests.
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

import assert from 'assert';
import TestUtil from './util.js';
import { all as allFormats } from '../index.js';

const gameFiles = {
	'arc-bnk-harry': {
		'sfx.bnk': {
			'coin.4bt': '+IXuGOTsqUq6m3A0VsDsY2qzLfU=',
		},
	},
	'arc-bpa-drally': {
		'ibfiles.bpa': {
			'rasti1.bpk': 'uO/QATW2iRwsJjepOWZOCN57xtA=',
		},
	},
	'arc-dat-fast': {
		'bash1.dat': {
			'main.imf': 'vrkhbVklGu+zXJ50yx8kFbERCQM=',
		},
	},
	'arc-dat-wacky': {
		'wacky.dat': {
			'giggles.sp': 'K8LYN1pXWnP/xiM4S7YM5l4nKQM=',
		},
	},
	'arc-epf-eastpoint': {
		'lionking.epf': {
			'level1.map': '86gn5r9wamypIqu8QVOfRpl4KB8=',
		},
	},
	'arc-gamemaps-id': {
		'maptemp.bm1': {
			'00/plane0': 'l5EuS0F4jMCeuagaCcEOI1s4hlg=',
		},
		'maptemp.wl1': {
			'00/plane0': 'NRg+/uMmRwulXNF05eaVj8IbrH4=',
		},
	},
	'arc-gamemaps-id-carmack': {
		'gamemaps.ck4': {
			'00/plane0': 'OEjwjwhWvCqZmGUFnMuDI8YQekI=',
		},
		'gamemaps.wl6': {
			'00/plane0': '1yFmmL3MtrvlM82jsHws0Uu7piA=',
		},
	},
	'arc-grp-build': {
		'duke3d.grp': {
			'stalker.mid': 'IMvGH7NFxcIq19h3yMK3Vhg9CiM=',
		},
	},
	'arc-glb-raptor': {
		'file0000.glb': {
			'file_id_diz': 'bV4tAoHmqCFQ4JF/OcewRIJLZgc=',
		},
	},
	'arc-hog-descent': {
		'descent.hog': {
			'mars01.pcx': '1I2GeA+DJMCezPFwdRGk19HDT/o=',
		},
	},
	'arc-lbr-vinyl': {
		'goddess.lbr': {
			'prowler.mus': 'JgjwQkMd5Um9KBJ33c9S5sv4dfU=',
		},
	},
	'arc-pod-tv': {
		'startup.pod': {
			'fog\\vga.map': 'hxJZ7TpTNE/7C4tYqUo6ncw2N7s=',
		},
	},
	'arc-rff-blood-v301': {
		'gui.rff': {
			'uparrow.qbm': '6g5PDHpIjBhNcKc84H7ui/VhGUo=',
		},
	},
	'arc-vol-cosmo': {
		'cosmo1.vol': {
			'mzztop.mni': 'CfsTVENVO16mqSCcP4DajWbGNkM=',
		},
	},
};

describe(`Tests with real game files (if present)`, function() {

	let format = {};

	for (const idFormat of Object.keys(gameFiles)) {
		const f = {};
		f.handler = allFormats.find(t => t.metadata().id === idFormat);
		if (!f.handler) {
			throw new Error(`BUG: Test code has cases for format "${idFormat}" but `
				+ `this format isn't part of the library!`);
		}
		f.md = f.handler.metadata();
		f.testutil = new TestUtil(f.md.id);
		format[idFormat] = f;
	}

	before('load test data from local filesystem', function() {
		for (const [ idFormat, files ] of Object.entries(gameFiles)) {
			const { testutil, handler } = format[idFormat];
			try {
				format[idFormat].content = testutil.loadDirect(handler, Object.keys(files));
			} catch (e) {
				console.log(e.message);
			}
		}
	});

	for (const [ idFormat, files ] of Object.entries(gameFiles)) {
		const md = format[idFormat].md;

		describe(`${md.title} [${md.id}]`, function() {

			describe('identify()', function() {

				for (const archiveFilename of Object.keys(files)) {
					it(`should recognise ${archiveFilename}`, function() {
						// The next line has to be inside the it() otherwise it evaluates
						// too early, before the before() block above has populated the
						// object.
						const { handler, content } = format[idFormat];
						if (!content) this.skip();
						const result = handler.identify(
							content[archiveFilename].main,
							content[archiveFilename].main.filename
						);
						assert.ok(result, `Handler did not return a valid result object`);
						assert.notEqual(result.valid, false, `Handler did not recognise ${archiveFilename}: ${result.reason}`);
					});
				}

				for (const [ idFormat2, files2 ] of Object.entries(gameFiles)) {
					if (idFormat2 === idFormat) continue; // skip ourselves

					if (!format[idFormat2]) {
						throw new Error(`BUG: Tests tried to access non-existent format "${idFormat2}".`);
					}
					for (const archiveFilename2 of Object.keys(files2)) {
						it(`should not recognise ${idFormat2} file ${archiveFilename2}`, function() {
							// These also have to be inside the it() the same as above.
							const { content: content2 } = format[idFormat2];
							if (!content2) this.skip();
							const { handler } = format[idFormat];
							const result = handler.identify(
								content2[archiveFilename2].main,
								content2[archiveFilename2].main.filename
							);
							assert.equal(result.valid, false);
						});
					}
				}

			}); // identify()

			describe('parse()/generate()', function() {

				for (const [ archiveFilename, targetFiles ] of Object.entries(files)) {
					it(`should read and rewrite ${archiveFilename}`, function() {
						const { handler, content } = format[idFormat];
						if (!content) this.skip();
						const archive = handler.parse(content[archiveFilename]);

						let origContent = {};

						// Check the original archive.
						for (const [ targetFile, targetHash ] of Object.entries(targetFiles)) {
							const file = archive.files.find(f => f.name.toLowerCase() === targetFile.toLowerCase());
							assert.ok(file, `Unable to find "${targetFile}" inside "${archiveFilename}"`);

							// Use decompressed/decrypted content so that differences in
							// compression algorithms don't affect the result.
							const content = file.getContent();

							assert.equal(TestUtil.hash(content), targetHash,
								`Content for "${targetFile}" extracted from "${archiveFilename}" `
								+ `differs to what was expected.`);

							origContent[targetFile] = content;
						}

						// Generate a new archive that should be identical to the original.
						const output = handler.generate(archive);
						const archive2 = handler.parse(output);

						// Now try re-reading the new one.  It won't matter whether any
						// compression algorithms produce different data because we'll be
						// comparing the file content after decompression.
						for (const targetFile of Object.keys(targetFiles)) {
							const file = archive2.files.find(f => f.name.toLowerCase() === targetFile.toLowerCase());
							assert.ok(file, `Unable to find "${targetFile}" inside the `
								+ `regenerated version of "${archiveFilename}"`);

							// Use decompressed/decrypted content so that differences in
							// compression algorithms don't affect the result.
							const content = file.getContent();

							// Compare the content against what was read from the first file,
							// which also passed the hash check.  This way if the content is
							// wrong, we get a hex dump of the differences rather than just
							// a "hash doesn't match" error.
							TestUtil.buffersEqual(origContent[targetFile], content);
						}
					});
				}

			}); // parse()/generate()

		}); // describe(format)

	} // foreach format

}); // Real game file tests
