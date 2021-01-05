/*
 * Extra tests for arc-vol-cosmo.
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
import { arc_vol_cosmo as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'short',
				'file_in_fat',
				'file_past_eof',
			]);
		});

		describe('identify()', function() {

			it('should reject short files', function() {
				const result = handler.identify(
					content['short'].main,
					content['short'].main.filename
				);
				assert.equal(result.reason, 'Archive too short to contain full FAT.');
				assert.equal(result.valid, false);
			});

			it('should reject file content starting inside FAT', function() {
				const result = handler.identify(
					content['file_in_fat'].main,
					content['file_in_fat'].main.filename
				);
				assert.equal(result.reason, `File 1 @ offset 438 starts inside the FAT which ends at offset 4000.`);
				assert.equal(result.valid, false);
			});

			it('should reject file ending past archive EOF', function() {
				const result = handler.identify(
					content['file_past_eof'].main,
					content['file_past_eof'].main.filename
				);
				assert.equal(result.reason, `File 2 ends beyond the end of the archive.`);
				assert.equal(result.valid, false);
			});

		}); // identify()

	}); // I/O

}); // Extra tests
