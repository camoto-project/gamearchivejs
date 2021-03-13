/*
 * Extra tests for arc-fixed-keen4_exe.
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
import { arc_fixed_keen4_exe as handler } from '../index.js';
import { arc_fixed_keen5_exe } from '../index.js';
import { arc_fixed_keen6_exe } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('Real game files (if present)', function() {

		before('load game files from local filesystem', function() {
			try {
				content = testutil.loadDirect(handler, [
					'keen4c-1.0.exe',
					'keen4c-1.1.exe',
					'keen4c-1.4f.exe',
					'keen4e-1.0-demo.exe',
					'keen4e-1.0.exe',
					'keen4e-1.1.exe',
					'keen4e-1.2.exe',
					'keen4e-1.4.exe',
					'keen4e-1.4f.exe',
					'keen4e-1.4g.exe',
				]);
			} catch (e) {
				console.log(e.message);
				this.skip();
			}
		});

		describe('identify()', function() {

			const versions = {
				'keen4c-1.0': '4 CGA (v1.0)',
				'keen4c-1.1': '4 CGA (v1.1)',
				'keen4c-1.4f': '4 CGA (v1.4f)',
				'keen4e-1.0-demo': '4 EGA (v1.0, demo)',
				'keen4e-1.0': '4 EGA (v1.0)',
				'keen4e-1.1': '4 EGA (v1.1)',
				'keen4e-1.2': '4 EGA (v1.2)',
				'keen4e-1.4': '4 EGA (v1.4/v1.4f)',
				'keen4e-1.4f': '4 EGA (v1.4/v1.4f)',
				'keen4e-1.4g': '4 EGA (v1.4g)',
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

				it(`arc-fixed-keen5_exe should not recognise ${id}`, function() {
					const result = arc_fixed_keen5_exe.identify(
						content[id + '.exe'].main,
						content[id + '.exe'].main.filename
					);
					assert.equal(result.valid, false);
				});

				it(`arc-fixed-keen6_exe should not recognise ${id}`, function() {
					const result = arc_fixed_keen6_exe.identify(
						content[id + '.exe'].main,
						content[id + '.exe'].main.filename
					);
					assert.equal(result.valid, false);
				});
			}

		}); // identify()

		describe('parse()', function() {

			const versions = {
				'keen4c-1.0' : { size: 0x28C, hash: 'Z6lIrlYVw2vhsnVl4VVALhxdRrk=' },
				'keen4c-1.1' : { size: 0x28C, hash: 'Z6lIrlYVw2vhsnVl4VVALhxdRrk=' },
				'keen4c-1.4f': { size: 0x28C, hash: 'Z6lIrlYVw2vhsnVl4VVALhxdRrk=' },
				'keen4e-1.0-demo' : { name: 'egahead.ck4', size: 0x495C, hash: 'onXd8Dz98uuldUySPvt8jsKvXU0=' },
				'keen4e-1.0' : { size: 0x28C, hash: 'Z6lIrlYVw2vhsnVl4VVALhxdRrk=' },
				'keen4e-1.1' : { size: 0x28C, hash: 'Z6lIrlYVw2vhsnVl4VVALhxdRrk=' },
				'keen4e-1.2' : { size: 0x28C, hash: 'Z6lIrlYVw2vhsnVl4VVALhxdRrk=' },
				'keen4e-1.4':  { size: 0x28C, hash: 'Z6lIrlYVw2vhsnVl4VVALhxdRrk=' },
				'keen4e-1.4f': { size: 0x28C, hash: 'Z6lIrlYVw2vhsnVl4VVALhxdRrk=' },
				'keen4e-1.4g': { size: 0x28C, hash: 'Z6lIrlYVw2vhsnVl4VVALhxdRrk=' },
			};

			for (const [id, version] of Object.entries(versions)) {
				it(`should extract a file from ${id}`, function() {
					const archive = handler.parse(content[id + '.exe']);
					assert.equal(archive.files[1].name, version.name || 'audiohed.ck4');

					const data = archive.files[1].getContent();
					assert.equal(data.length, version.size);
					assert.equal(TestUtil.hash(data), version.hash);
				});
			}

		}); // parse()

	}); // Real game files

}); // Extra tests
