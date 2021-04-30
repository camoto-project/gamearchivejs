/*
 * Extra tests for arc-exe-ddave.
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
import { arc_exe_ddave as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	describe('Real game files (if present)', function() {
		let content = {};

		before('load game files from local filesystem', function() {
			try {
				content = testutil.loadDirect(handler, [
					'dave.exe',
					'dave.cmp-lzexe.revealed',
				]);
			} catch (e) {
				console.log(e.message);
				this.skip();
			}
		});

		describe('identify()', function() {

			it('should recognise real game files', function() {
				const result = handler.identify(
					content['dave.exe'].main,
					content['dave.exe'].main.filename
				);
				assert.equal(result.valid, true);
			});

		}); // identify()

		describe('parse()', function() {

			it('should extract a file', function() {
				const archive = handler.parse(content['dave.exe']);

				assert.equal(archive.files[9].name, 'level01.dav');
				const data = archive.files[9].getContent();
				assert.equal(data.length, 1280);
				assert.equal(TestUtil.hash(data), 'p3lhBx/mYqB8UWbV7IgVyBRNMsA=');
			});

			it('should decompress a file', function() {
				const archive = handler.parse(content['dave.exe']);

				assert.equal(archive.files[2].name, 'vgadave.dav');
				const data = archive.files[2].getContent();
				assert.equal(data.length, 71238);
				assert.equal(TestUtil.hash(data), 'tpHYAQ4TX4gx5SFZRS3Zp7kbiek=');
			});

		}); // parse()

		describe('generate()', function() {

			it('file comes out the same as it went in', async function() {
				const archive = handler.parse(content['dave.exe']);

				const contentGenerated = handler.generate(archive);
				TestUtil.contentEqual(content['dave.cmp-lzexe.revealed'], contentGenerated);
			});

		}); // generate()

	}); // Real game files

}); // Extra tests
