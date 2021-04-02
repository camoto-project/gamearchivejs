/*
 * Extra tests for arc-bnk-harry.
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
import { arc_bnk_harry as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'empty',
				'short',
				'wrong_sig1',
				'trunc_f1',
				'only_f1',
				'trunc_f2',
				'wrong_sig2',
			]);
		});

		describe('identify()', function() {

			it('should accept empty files', function() {
				const result = handler.identify(
					content['empty'].main,
					content['empty'].main.filename
				);
				assert.equal(result.reason, 'Empty file.');
				assert.equal(result.valid, true);
			});

			it('should reject short files', function() {
				const result = handler.identify(
					content['short'].main,
					content['short'].main.filename
				);
				assert.equal(result.reason, 'Content too short (< 22 b).');
				assert.equal(result.valid, false);
			});

			it('should reject wrong signature on first file', function() {
				const result = handler.identify(
					content['wrong_sig1'].main,
					content['wrong_sig1'].main.filename
				);
				assert.equal(result.reason, `Wrong signature "-OD-".`);
				assert.equal(result.valid, false);
			});

			it('should reject where first file is truncated', function() {
				const result = handler.identify(
					content['trunc_f1'].main,
					content['trunc_f1'].main.filename
				);
				assert.equal(result.reason, `First file is truncated.`);
				assert.equal(result.valid, false);
			});

			it('should accept archive with only one file', function() {
				const result = handler.identify(
					content['only_f1'].main,
					content['only_f1'].main.filename
				);
				assert.equal(result.reason, `Only one file.`);
				assert.equal(result.valid, true);
			});

			it('should accept archive with only one file', function() {
				const result = handler.identify(
					content['trunc_f2'].main,
					content['trunc_f2'].main.filename
				);
				assert.equal(result.reason, `Second file header truncated.`);
				assert.equal(result.valid, false);
			});

			it('should reject wrong signature on second file', function() {
				const result = handler.identify(
					content['wrong_sig2'].main,
					content['wrong_sig2'].main.filename
				);
				assert.equal(result.reason, `Wrong signature for second file "-IF-".`);
				assert.equal(result.valid, false);
			});

		}); // identify()

	}); // I/O

}); // Extra tests
