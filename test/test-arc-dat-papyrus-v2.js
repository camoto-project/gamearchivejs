/*
 * Extra tests for arc-dat-papyrus-v2.
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
import { arc_dat_papyrus_v2 as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'short',
				'short_fat',
				'bad_flags',
				'file_starts_past_eof',
				'file_ends_past_eof',
				'size_mismatch',
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
					content['short_fat'].main,
					content['short_fat'].main.filename
				);
				assert.equal(result.reason, `Content too short for file count.`);
				assert.equal(result.valid, false);
			});

			it('should reject invalid storage flags', function() {
				const result = handler.identify(
					content['bad_flags'].main,
					content['bad_flags'].main.filename
				);
				assert.equal(result.reason, `File 2 @ offset 155 does not use the only valid flags for this format.`);
				assert.equal(result.valid, false);
			});

			it('should reject file that starts past archive EOF', function() {
				const result = handler.identify(
					content['file_starts_past_eof'].main,
					content['file_starts_past_eof'].main.filename
				);
				assert.equal(result.reason, 'File 3 @ offset 200 starts beyond the end of the archive.');
				assert.equal(result.valid, false);
			});

			it('should reject file that ends past archive EOF', function() {
				const result = handler.identify(
					content['file_ends_past_eof'].main,
					content['file_ends_past_eof'].main.filename
				);
				assert.equal(result.reason, 'File 3 ends beyond the end of the archive.');
				assert.equal(result.valid, false);
			});

			it('should reject file that has mismatched disk/native sizes', function() {
				const result = handler.identify(
					content['size_mismatch'].main,
					content['size_mismatch'].main.filename
				);
				assert.equal(result.reason, 'File 0 lists a different diskSize and nativeSize, despite compression being unsupported.');
				assert.equal(result.valid, false);
			});

			it('should reject file with trailing data', function() {
				const result = handler.identify(
					content['trailing_data'].main,
					content['trailing_data'].main.filename
				);
				assert.equal(result.reason, 'Trailing data after last file.');
				assert.equal(result.valid, false);
			});

		}); // identify()

	}); // I/O

}); // Extra tests
