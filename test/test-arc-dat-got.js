/*
 * Extra tests for arc-dat-got.
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
import { arc_dat_got as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'short_fat',
				'fat_trailing_data',
				'file_past_eof',
				'trailing_data',
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

			it('should reject on data between FAT and first file', function() {
				const result = handler.identify(
					content['fat_trailing_data'].main,
					content['fat_trailing_data'].main.filename
				);
				assert.equal(result.reason, 'First file does not immediately follow FAT (offset 5889 is not 5888).');
				assert.equal(result.valid, false);
			});

			it('should reject file past archive EOF', function() {
				const result = handler.identify(
					content['file_past_eof'].main,
					content['file_past_eof'].main.filename
				);
				assert.equal(result.reason, 'File 3 extends beyond the end of the archive.');
				assert.equal(result.valid, false);
			});

			it('should reject on extra data after last file', function() {
				const result = handler.identify(
					content['trailing_data'].main,
					content['trailing_data'].main.filename
				);
				assert.equal(result.reason, `Last file finishes at offset 5984 which is not the end of the archive at 5985.`);
				assert.equal(result.valid, false);
			});

		}); // identify()

	}); // I/O

}); // Extra tests
