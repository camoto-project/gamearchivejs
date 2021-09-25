/*
 * Extra tests for arc-dat-lostvikings.
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
import { arc_dat_lostvikings as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'short_fat',
				'long_fat',
				'uneven_fat',
				'file_past_eof',
				'file_negative_size',
			]);
		});

		describe('identify()', function() {

			it('should reject truncated FAT', function() {
				const result = handler.identify(
					content['short_fat'].main,
					content['short_fat'].main.filename
				);
				assert.equal(result.reason, `Not enough space for FAT.`);
				assert.equal(result.valid, false);
			});

			it('should reject FAT extending past EOF', function() {
				const result = handler.identify(
					content['long_fat'].main,
					content['long_fat'].main.filename
				);
				assert.equal(result.reason, 'FAT ends at or past EOF.');
				assert.equal(result.valid, false);
			});

			it('should reject FAT not divisible by 4', function() {
				const result = handler.identify(
					content['uneven_fat'].main,
					content['uneven_fat'].main.filename
				);
				assert.equal(result.reason, 'FAT is not divisible by 4.');
				assert.equal(result.valid, false);
			});

			it('should reject file past archive EOF', function() {
				const result = handler.identify(
					content['file_past_eof'].main,
					content['file_past_eof'].main.filename
				);
				assert.equal(result.reason, 'File 2 @ offset 114 starts at or beyond the end of the archive.');
				assert.equal(result.valid, false);
			});

			it('should reject files of negative size', function() {
				const result = handler.identify(
					content['file_negative_size'].main,
					content['file_negative_size'].main.filename
				);
				assert.equal(result.reason, `File 1 @ offset 38 is before the preceding file at offset 63 (negative file size).`);
				assert.equal(result.valid, false);
			});

		}); // identify()

	}); // I/O

}); // Extra tests
