/**
 * @file Extra tests for supplemental file helper functions.
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
import {
	getBasename,
	getExtension,
	getFilename,
	replaceBasename,
	replaceExtension,
	replaceFilename,
} from '../util/supp.js';

describe(`Extra tests for supplemental data functions`, function() {

	describe('replaceExtension()', function() {
		it('replaces a normal extension', function() {
			assert.equal(
				replaceExtension('test.dat', 'abc'),
				'test.abc'
			);
		});

		it('replaces a short extension', function() {
			assert.equal(
				replaceExtension('test.d', 'abc'),
				'test.abc'
			);
		});

		it('replaces a long extension', function() {
			assert.equal(
				replaceExtension('test.theme', 'abc'),
				'test.abc'
			);
		});

		it('replaces a filename with a path', function() {
			assert.equal(
				replaceExtension('/one/two/test.dat', 'abc'),
				'/one/two/test.abc'
			);
		});

		it('just adds an extension if there is none', function() {
			assert.equal(
				replaceExtension('test', 'abc'),
				'test.abc'
			);
		});

		it('adds the extension if there is none but with a path', function() {
			assert.equal(
				replaceExtension('/one/two/test', 'abc'),
				'/one/two/test.abc'
			);
		});

		it('ignores dots within the path', function() {
			assert.equal(
				replaceExtension('/one.dat/test.dat', 'abc'),
				'/one.dat/test.abc'
			);
		});

		it('ignores dots within the path even if the file has no extension', function() {
			assert.equal(
				replaceExtension('/one.dat/test', 'abc'),
				'/one.dat/test.abc'
			);
		});

		it('ignores dots within the filename', function() {
			assert.equal(
				replaceExtension('test.ing.dat', 'abc'),
				'test.ing.abc'
			);
		});

	});

	describe('replaceBasename()', function() {
		it('replaces a normal basename', function() {
			assert.equal(
				replaceBasename('test.dat', 'abc'),
				'abc.dat'
			);
		});

		it('replaces a basename with a path', function() {
			assert.equal(
				replaceBasename('/blah/test.dat', 'abc'),
				'/blah/abc.dat'
			);
		});

		it('replaces a basename with no extension and a path', function() {
			assert.equal(
				replaceBasename('/blah/test', 'abc'),
				'/blah/abc'
			);
		});

		it('replaces a basename with a long path', function() {
			assert.equal(
				replaceBasename('/one/two/three/test.dat', 'abc'),
				'/one/two/three/abc.dat'
			);
		});

		it('handles dots in the filename', function() {
			assert.equal(
				replaceBasename('/one/two/three/test.ing.dat', 'abc'),
				'/one/two/three/abc.dat'
			);
		});

	});

	describe('replaceFilename()', function() {
		it('replaces a normal filename', function() {
			assert.equal(
				replaceFilename('test.dat', 'abc.def'),
				'abc.def'
			);
		});

		it('replaces a filename with a path', function() {
			assert.equal(
				replaceFilename('/blah/test.dat', 'abc.def'),
				'/blah/abc.def'
			);
		});

		it('replaces a filename with no extension and a path', function() {
			assert.equal(
				replaceFilename('/blah/test', 'abc'),
				'/blah/abc'
			);
		});

		it('replaces a filename with an extension and a path with one without an extension', function() {
			assert.equal(
				replaceFilename('/blah/test.dat', 'def'),
				'/blah/def'
			);
		});

		it('replaces a filename with a long path', function() {
			assert.equal(
				replaceFilename('/one/two/three/test.dat', 'abc.def'),
				'/one/two/three/abc.def'
			);
		});

	});

	describe('getFilename()', function() {
		it('extract from a normal filename', function() {
			assert.equal(
				getFilename('test.dat'),
				'test.dat'
			);
		});

		it('extract from a filename with a path', function() {
			assert.equal(
				getFilename('/one/two/three/test.dat'),
				'test.dat'
			);
		});

		it('extract from a path without an extension', function() {
			assert.equal(
				getFilename('/one/two/test'),
				'test'
			);
		});

		it('extract from no path without an extension', function() {
			assert.equal(
				getFilename('test'),
				'test'
			);
		});

	});

	describe('getBasename()', function() {
		it('extract from a normal filename', function() {
			assert.equal(
				getBasename('test.dat'),
				'test'
			);
		});

		it('extract from a filename with a path', function() {
			assert.equal(
				getBasename('/one/two/three/test.dat'),
				'test'
			);
		});

		it('extract from a path without an extension', function() {
			assert.equal(
				getBasename('/one/two/test'),
				'test'
			);
		});

		it('extract from no path without an extension', function() {
			assert.equal(
				getBasename('test'),
				'test'
			);
		});

	});

	describe('getExtension()', function() {
		it('extract from a normal filename', function() {
			assert.equal(
				getExtension('test.dat'),
				'dat'
			);
		});

		it('extract from a filename with a path', function() {
			assert.equal(
				getExtension('/one/two/three/test.dat'),
				'dat'
			);
		});

		it('extract from a path without an extension', function() {
			assert.equal(
				getExtension('/one/two/test'),
				''
			);
		});

		it('extract from no path without an extension', function() {
			assert.equal(
				getExtension('test'),
				''
			);
		});

		it('extract from a filename with dots', function() {
			assert.equal(
				getExtension('test.ing.dat'),
				'dat'
			);
		});

		it('extract from a folder with dots', function() {
			assert.equal(
				getExtension('/one.two/test.dat'),
				'dat'
			);
		});

	});
});
