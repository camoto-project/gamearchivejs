/**
 * @file Extra tests for supplemental file helper functions.
 *
 * Copyright (C) 2018-2019 Adam Nielsen <malvineous@shikadi.net>
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

const assert = require('assert');

const Supp = require('../formats/supp.js');

describe(`Extra tests for supplemental data functions`, function() {

	describe('replaceExtension()', function() {
		it('replaces a normal extension', function() {
			assert.equal(
				Supp.replaceExtension('test.dat', 'abc'),
				'test.abc'
			);
		});

		it('replaces a short extension', function() {
			assert.equal(
				Supp.replaceExtension('test.d', 'abc'),
				'test.abc'
			);
		});

		it('replaces a long extension', function() {
			assert.equal(
				Supp.replaceExtension('test.theme', 'abc'),
				'test.abc'
			);
		});

		it('replaces a filename with a path', function() {
			assert.equal(
				Supp.replaceExtension('/one/two/test.dat', 'abc'),
				'/one/two/test.abc'
			);
		});

		it('just adds an extension if there is none', function() {
			assert.equal(
				Supp.replaceExtension('test', 'abc'),
				'test.abc'
			);
		});

		it('adds the extension if there is none but with a path', function() {
			assert.equal(
				Supp.replaceExtension('/one/two/test', 'abc'),
				'/one/two/test.abc'
			);
		});

		it('ignores dots within the path', function() {
			assert.equal(
				Supp.replaceExtension('/one.dat/test.dat', 'abc'),
				'/one.dat/test.abc'
			);
		});

		it('ignores dots within the path even if the file has no extension', function() {
			assert.equal(
				Supp.replaceExtension('/one.dat/test', 'abc'),
				'/one.dat/test.abc'
			);
		});

	});

	describe('replaceBasename()', function() {
		it('replaces a normal basename', function() {
			assert.equal(
				Supp.replaceBasename('test.dat', 'abc'),
				'abc.dat'
			);
		});

		it('replaces a basename with a path', function() {
			assert.equal(
				Supp.replaceBasename('/blah/test.dat', 'abc'),
				'/blah/abc.dat'
			);
		});

		it('replaces a basename with no extension and a path', function() {
			assert.equal(
				Supp.replaceBasename('/blah/test', 'abc'),
				'/blah/abc'
			);
		});
	});
});
