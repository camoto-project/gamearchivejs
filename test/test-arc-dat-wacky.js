/*
 * Extra tests for arc-dat-wacky.
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
import { arc_dat_wacky as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'short',
				'fat_trunc',
				'file_in_fat',
				'file_past_eof',
				'trailing_data',
			]);
		});

		describe('identify()', function() {

			it('should reject short files', function() {
				const result = handler.identify(
					content['short'].main,
					content['short'].main.filename
				);
				assert.equal(result.reason, 'Content too short (< 2 b).');
				assert.equal(result.valid, false);
			});

			it('should reject truncated FAT', function() {
				const result = handler.identify(
					content['fat_trunc'].main,
					content['fat_trunc'].main.filename
				);
				assert.equal(result.reason, `FAT truncated (file length 32 < FAT length 90).`);
				assert.equal(result.valid, false);
			});

			it('should reject file content starting inside FAT', function() {
				const result = handler.identify(
					content['file_in_fat'].main,
					content['file_in_fat'].main.filename
				);
				assert.equal(result.reason, `File 0 @ offset 72 starts inside the FAT which ends at offset 90.`);
				assert.equal(result.valid, false);
			});

			it('should reject file ending past archive EOF', function() {
				const result = handler.identify(
					content['file_past_eof'].main,
					content['file_past_eof'].main.filename
				);
				assert.equal(result.reason, `File 3 ends beyond the end of the archive.`);
				assert.equal(result.valid, false);
			});

			it('should be unsure of archive with trailing data', function() {
				const result = handler.identify(
					content['trailing_data'].main,
					content['trailing_data'].main.filename
				);
				assert.equal(result.reason, `Trailing data at end of archive.`);
				assert.equal(result.valid, false);
			});

		}); // identify()

	}); // I/O

}); // Extra tests
