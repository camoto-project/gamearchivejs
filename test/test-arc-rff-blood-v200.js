/*
 * Extra tests for arc-rff-blood-v200.
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
import { arc_rff_blood_v200 as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'short',
				'wrong_sig',
				'wrong_ver',
			]);
		});

		describe('identify()', function() {

			it('should reject short files', function() {
				const result = handler.identify(
					content['short'].main,
					content['short'].main.filename
				);
				assert.equal(result.reason, 'Content too short (< 32 b).');
				assert.equal(result.valid, false);
			});

			it('should reject wrong signature', function() {
				const result = handler.identify(
					content['wrong_sig'].main,
					content['wrong_sig'].main.filename
				);
				assert.equal(result.reason, `Wrong signature.`);
				assert.equal(result.valid, false);
			});

			it('should reject wrong file version', function() {
				const result = handler.identify(
					content['wrong_ver'].main,
					content['wrong_ver'].main.filename
				);
				// This version number should be handled by arc-rff-blood-v300 instead.
				assert.equal(result.reason, `Unsupported RFF version 3.0.`);
				assert.equal(result.valid, false);
			});

		}); // identify()

	}); // I/O

}); // Extra tests
