/*
 * Extra tests for arc-bpa-drally.
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
import { arc_bpa_drally as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'short',
				'many_files',
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
				assert.equal(result.reason, 'Content too short (< 4339 b).');
				assert.equal(result.valid, false);
			});

			it('should reject on too many files', function() {
				const result = handler.identify(
					content['many_files'].main,
					content['many_files'].main.filename
				);
				assert.equal(result.reason, `Too many files (256 > max 255).`);
				assert.equal(result.valid, false);
			});

			it('should reject file past archive EOF', function() {
				const result = handler.identify(
					content['file_past_eof'].main,
					content['file_past_eof'].main.filename
				);
				assert.equal(result.reason, 'File 3 ends beyond the end of the archive.');
				assert.equal(result.valid, false);
			});

			it('should reject file inside FAT', function() {
				const result = handler.identify(
					content['trailing_data'].main,
					content['trailing_data'].main.filename
				);
				assert.equal(result.reason, '1 byte(s) of trailing data at EOF.');
				assert.equal(result.valid, false);
			});

		}); // identify()

	}); // I/O

}); // Extra tests
