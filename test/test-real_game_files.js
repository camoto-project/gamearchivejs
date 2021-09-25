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
	'arc-cur-prehistorik': {
		'filesa.cur': {
			'rik8.mdi': 'Jf0b32V0w/WxPAl0U6vNoBfa7NI=',
		},
	},
	'arc-dat-fast': {
		'bash1.dat': {
			'main.imf': 'vrkhbVklGu+zXJ50yx8kFbERCQM=',
		},
	},
	'arc-dat-indy500': {
		'indy.1': {
			'@10': '2ii+WWzfLKNtd4P0y4xknGBcRQA=',
		},
	},
	'arc-dat-lostvikings': {
		'data.dat': {
			'@10': '2XduhcLb7ozU5wi46leN3ZHhjS0=',
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
	'arc-exe-keen4-cga_1v0': {
		'keen4c-1.0.exe': {
			'cgahead.ck4' : 'V5GVAmzN4NM6tXefBbXo6qKBnrE=',
			'maphead.ck4' : '7/NjOjrzbUGmH3BAb2lBElVHkQM=',
		},
	},
	'arc-exe-keen4-cga_1v1': {
		'keen4c-1.1.exe': {
			'cgahead.ck4' : 'V5GVAmzN4NM6tXefBbXo6qKBnrE=',
			'maphead.ck4' : '7/NjOjrzbUGmH3BAb2lBElVHkQM=',
		},
	},
	'arc-exe-keen4-cga_1v4f': {
		'keen4c-1.4f.exe': {
			'cgahead.ck4' : 'S6nqMmTgVO+zrI0e+GyvaGzqxl0=',
			'maphead.ck4' : '7/NjOjrzbUGmH3BAb2lBElVHkQM=',
		},
	},
	'arc-exe-keen4-ega_1v0': {
		'keen4e-1.0.exe': {
			'egahead.ck4' : 'kyM1evrLR023M/yNoIuvSjkllHo=',
			'maphead.ck4' : '7/NjOjrzbUGmH3BAb2lBElVHkQM=',
		},
	},
	'arc-exe-keen4-ega_1v0d': {
		'keen4e-1.0-demo.exe': {
			'egahead.ck4' : 'onXd8Dz98uuldUySPvt8jsKvXU0=',
			'maphead.ck4' : '7/NjOjrzbUGmH3BAb2lBElVHkQM=',
		},
	},
	'arc-exe-keen4-ega_1v1': {
		'keen4e-1.1.exe': {
			'egahead.ck4' : 'kyM1evrLR023M/yNoIuvSjkllHo=',
			'maphead.ck4' : '7/NjOjrzbUGmH3BAb2lBElVHkQM=',
		},
	},
	'arc-exe-keen4-ega_1v2': {
		'keen4e-1.2.exe': {
			'egahead.ck4' : 'VQ/eKJYtM902Ufqai47T2+z9wCM=',
			'maphead.ck4' : '7/NjOjrzbUGmH3BAb2lBElVHkQM=',
		},
	},
	'arc-exe-keen4-ega_1v4': {
		'keen4e-1.4.exe': {
			'egahead.ck4' : 'v1UtDXl78HeL6mRyBXpKSAgrTpw=',
			'maphead.ck4' : '7/NjOjrzbUGmH3BAb2lBElVHkQM=',
		},
		'keen4e-1.4f.exe': {
			'egahead.ck4' : 'rNrb9QWkHcdOIisrjLRJNM+yMeQ=',
			'maphead.ck4' : '7/NjOjrzbUGmH3BAb2lBElVHkQM=',
		},
	},
	'arc-exe-keen4-ega_1v4g': {
		'keen4e-1.4g.exe': {
			'egahead.ck4' : 'CMXqYW1lsLUmaBbnLPwt49YW3S0=',
			'maphead.ck4' : '7/NjOjrzbUGmH3BAb2lBElVHkQM=',
		},
	},
	'arc-exe-keen5-cga_1v4': {
		'keen5c-1.4.exe': {
			'cgahead.ck5' : '37qpTI7+o0+r74w8mO0VB/nqtcQ=',
			'maphead.ck5' : 'uoQLuHJDxmTzHovz/801/UmpoDo=',
		},
	},
	'arc-exe-keen5-ega_1v0': {
		'keen5e-1.0.exe': {
			'egahead.ck5' : '1jiic6vKHjJJb5NQwypIBcgLG40=',
			'maphead.ck5' : '+llqFRS3FzE0idsN3QB1fK3haGw=',
		},
	},
	'arc-exe-keen5-ega_1v4': {
		'keen5e-1.4.exe': {
			'egahead.ck5' : 'Xq+7nD8Z1RcavZaOKDKw2ID7YAc=',
			'maphead.ck5' : 'uoQLuHJDxmTzHovz/801/UmpoDo=',
		},
	},
	'arc-exe-keen5-ega_1v4g': {
		'keen5e-1.4g.exe': {
			'egahead.ck5' : 'uAJvgec8qDlGlsqyskyJ0SxD7L0=',
			'maphead.ck5' : 'm0ju60yF2VCcSuX9IidShutuBYw=',
		},
	},
	'arc-exe-keen6-cga_1v0': {
		'keen6c-1.0.exe': {
			'cgahead.ck6' : 'NDcf75V4FDRbWCyt6fZH+ttuMqU=',
			'maphead.ck6' : 'pri/Ph4gyfZhTlcj9IXmP15vekQ=',
		},
	},
	'arc-exe-keen6-cga_1v4': {
		'keen6c-1.4.exe': {
			'cgahead.ck6' : '/XlwKHMIEMuhYEIQ3Fm3uWqPa9U=',
			'maphead.ck6' : 'pbfnXiAhK2FGEj0OAjVKM2Fq3jQ=',
		},
	},
	'arc-exe-keen6-cga_1v5': {
		'keen6c-1.5.exe': {
			'cgahead.ck6' : '/XlwKHMIEMuhYEIQ3Fm3uWqPa9U=',
			'maphead.ck6' : 'cBkF7O+egMM9N/2LesswACNP794=',
		},
	},
	'arc-exe-keen6-ega_1v0': {
		'keen6e-1.0.exe': {
			'egahead.ck6' : 'yWEUPsW9qX48HMLdqtS8CzrYnBs=',
			'maphead.ck6' : 'pri/Ph4gyfZhTlcj9IXmP15vekQ=',
		},
	},
	'arc-exe-keen6-ega_1v0d': {
		'keen6e-1.0-demo.exe': {
			'egahead.ck6' : '6SZhurgtQWXAlIynxwa5rul5fEQ=',
			'maphead.ck6' : 'Ov9CbLuG/Y0jyj3y7Zg4afZ9ieE=',
		},
	},
	'arc-exe-keen6-ega_1v0p': {
		'keen6e-1.0-promo.exe': {
			'egahead.ck6' : 'oSsfZ8FGoF5e2dxIlwGyQiF3LXo=',
			'maphead.ck6' : 'Ov9CbLuG/Y0jyj3y7Zg4afZ9ieE=',
		},
	},
	'arc-exe-keen6-ega_1v4': {
		'keen6e-1.4.exe': {
			'egahead.ck6' : 'yFxuR8u62C7nPKBv4muEcDJtpNw=',
			'maphead.ck6' : 'pbfnXiAhK2FGEj0OAjVKM2Fq3jQ=',
		},
	},
	'arc-exe-keen6-ega_1v5': {
		'keen6e-1.5.exe': {
			'egahead.ck6' : 'j6uKuSo2uvrecIMzFwhMmRFJ220=',
			'maphead.ck6' : 'cBkF7O+egMM9N/2LesswACNP794=',
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
	'arc-wad-doom': {
		'doom1.wad': {
			'p/p1/exit1': '0Fh5LSD6JvVq3xpBJiK0fiJHUDs=',
		},
		'remote1.rts': {
			'remo/r_gotcha': 'Mt4pzLgd1ERkBzTVy9/+RQThMl8=',
		},
	},
};

// How long to wait (in seconds) for the slow archive regeneration tests to
// complete.  These are slow for large archives because they recompress all the
// files contained within.
const regenTimeout = 60;

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

			describe(`parse()/generate() - can be very slow, ${regenTimeout} s timeout`, function() {

				for (const [ archiveFilename, targetFiles ] of Object.entries(files)) {
					it(`should read and rewrite ${archiveFilename}`, function() {
						// The native JS compression is a bit slow so we need to allow a
						// bit more time to process the whole archive file.
						this.timeout(regenTimeout * 1000);

						const { handler, content } = format[idFormat];
						if (!content) this.skip();
						const archive = handler.parse(content[archiveFilename]);

						let origContent = {};

						// Check the original archive.
						for (const [ targetFilename, targetHash ] of Object.entries(targetFiles)) {
							let file;
							if (targetFilename[0] === '@') {
								// Test filename is of style "@123", so look by index.
								const index = parseInt(targetFilename.substr(1), 10);
								file = archive.files[index];
							} else {
								// Look by filename.
								file = archive.files.find(f => f.name.toLowerCase() === targetFilename.toLowerCase());
							}
							assert.ok(file, `Unable to find "${targetFilename}" inside "${archiveFilename}"`);

							// Use decompressed/decrypted content so that differences in
							// compression algorithms don't affect the result.
							const content = file.getContent();

							assert.equal(TestUtil.hash(content), targetHash,
								`Content for "${targetFilename}" extracted from "${archiveFilename}" `
								+ `differs to what was expected.`);

							origContent[targetFilename] = content;
						}

						// Generate a new archive that should be identical to the original.
						const output = handler.generate(archive);
						const archive2 = handler.parse(output);

						// Now try re-reading the new one.  It won't matter whether any
						// compression algorithms produce different data because we'll be
						// comparing the file content after decompression.
						for (const targetFilename of Object.keys(targetFiles)) {
							let file;
							if (targetFilename[0] === '@') {
								// Test filename is of style "@123", so look by index.
								const index = parseInt(targetFilename.substr(1), 10);
								file = archive2.files[index];
							} else {
								// Look by filename.
								file = archive2.files.find(f => f.name.toLowerCase() === targetFilename.toLowerCase());
							}
							assert.ok(file, `Unable to find "${targetFilename}" inside the `
								+ `regenerated version of "${archiveFilename}"`);

							// Use decompressed/decrypted content so that differences in
							// compression algorithms don't affect the result.
							const content = file.getContent();

							// Compare the content against what was read from the first file,
							// which also passed the hash check.  This way if the content is
							// wrong, we get a hex dump of the differences rather than just
							// a "hash doesn't match" error.
							TestUtil.buffersEqual(origContent[targetFilename], content);
						}
					});
				}

			}); // parse()/generate()

		}); // describe(format)

	} // foreach format

}); // Real game file tests
