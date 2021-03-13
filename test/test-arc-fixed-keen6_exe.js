/*
 * Extra tests for arc-fixed-keen6_exe.
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
import { arc_fixed_keen4_exe } from '../index.js';
import { arc_fixed_keen5_exe } from '../index.js';
import { arc_fixed_keen6_exe as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('Real game files (if present)', function() {

		before('load game files from local filesystem', function() {
			try {
				content = testutil.loadDirect(handler, [
					'keen6c-1.0.exe',
					'keen6c-1.4.exe',
					'keen6c-1.5.exe',
					'keen6e-1.0-demo.exe',
					'keen6e-1.0-promo.exe',
					'keen6e-1.0.exe',
					'keen6e-1.4.exe',
					'keen6e-1.5.exe',
				]);
			} catch (e) {
				console.log(e.message);
				this.skip();
			}
		});

		describe('identify()', function() {

			const versions = {
				'keen6c-1.0': '6 CGA (v1.0)',
				'keen6c-1.4': '6 CGA (v1.4)',
				'keen6c-1.5': '6 CGA (v1.5)',
				'keen6e-1.0-demo': '6 EGA (v1.0, demo)',
				'keen6e-1.0-promo': '6 EGA (v1.0, promo)',
				'keen6e-1.0': '6 EGA (v1.0)',
				'keen6e-1.4': '6 EGA (v1.4)',
				'keen6e-1.5': '6 EGA (v1.5)',
			};
			for (const [id, version] of Object.entries(versions)) {
				it(`should recognise ${id}`, function() {
					const result = handler.identify(
						content[id + '.exe'].main,
						content[id + '.exe'].main.filename
					);
					assert.equal(result.valid, true);
					assert.equal(result.reason, 'Keen ' + version);
				});

				it(`arc-fixed-keen4_exe should not recognise ${id}`, function() {
					const result = arc_fixed_keen4_exe.identify(
						content[id + '.exe'].main,
						content[id + '.exe'].main.filename
					);
					assert.equal(result.valid, false);
				});

				it(`arc-fixed-keen5_exe should not recognise ${id}`, function() {
					const result = arc_fixed_keen5_exe.identify(
						content[id + '.exe'].main,
						content[id + '.exe'].main.filename
					);
					assert.equal(result.valid, false);
				});
			}

		}); // identify()

		describe('parse()', function() {

			const versions = {
				'keen6c-1.0': { size: 0x2F8, hash: 'yu01jBQit4BdXEMRaEUC6ZBZSMw=' },
				'keen6c-1.4': { size: 0x2F8, hash: 'yu01jBQit4BdXEMRaEUC6ZBZSMw=' },
				'keen6c-1.5': { size: 0x2F8, hash: 'yu01jBQit4BdXEMRaEUC6ZBZSMw=' },
				'keen6e-1.0': { size: 0x2F8, hash: 'yu01jBQit4BdXEMRaEUC6ZBZSMw=' },
				'keen6e-1.4': { size: 0x2F8, hash: 'yu01jBQit4BdXEMRaEUC6ZBZSMw=' },

				'keen6e-1.5': { name: 'egahead.ck6', size: 0x412B, hash: 'j6uKuSo2uvrecIMzFwhMmRFJ220=' },

				'keen6e-1.0-demo': { size: 0x24C, hash: 'ea7tNhHdB87wVXIq8NAPB1022b4=' },
				'keen6e-1.0-promo': { size: 0x24C, hash: 'ea7tNhHdB87wVXIq8NAPB1022b4=' },
			};

			for (const [id, version] of Object.entries(versions)) {
				it(`should extract a file from ${id}`, function() {
					const archive = handler.parse(content[id + '.exe']);
					assert.equal(archive.files[1].name, version.name || 'audiohed.ck6');

					const data = archive.files[1].getContent();
					assert.equal(data.length, version.size);
					assert.equal(TestUtil.hash(data), version.hash);
				});
			}

		}); // parse()

	}); // Real game files

}); // Extra tests
