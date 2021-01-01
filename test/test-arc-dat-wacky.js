/**
 * @file Extra tests for arc-dat-wacky.
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

const assert = require('assert');

const TestUtil = require('./util.js');
const GameArchive = require('../index.js');

const format = 'arc-dat-wacky';

const handler = GameArchive.getHandler(format);
const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	let content = {};
	before('load test data from local filesystem', function() {
		content = testutil.loadContent(handler, [
			'default',
		]);
	});

	describe('identify()', function() {
		it('works even on incomplete FAT entries', function() {
			handler.identify(content.default.main.slice(0, 7));
			// Should not throw
			assert.ok(true);
		});
	});

});
