/**
 * @file Extra tests for arc-wad-doom.
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

const TestUtil = require('./util.js');
const GameArchive = require('../index.js');
const Archive = require('../formats/archive.js');

const format = 'arc-wad-doom';

const handler = GameArchive.getHandler(format);
const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	let content = {};
	before('load test data from local filesystem', function() {
		content = testutil.loadContent(handler, [
			'folders',
		]);
	});

	describe('parse()', function() {
		it('start/end entries converted into folders', function() {
			let archive = handler.parse(content.folders);
			assert.equal(archive.files[0].name.toUpperCase(), 'E1M1/THINGS');
			assert.equal(archive.files[1].name.toUpperCase(), 'E1M1/BEHAVIOR');
			assert.equal(archive.files[2].name.toUpperCase(), 'E1M2/LINEDEFS');
			assert.equal(archive.files[3].name.toUpperCase(), 'E1M2/BLOCKMAP');
			assert.equal(archive.files[4].name.toUpperCase(), 'ROOT');
			assert.equal(archive.files[5].name.toUpperCase(), 'A/B/TEST');
			assert.equal(archive.files[6].name.toUpperCase(), 'ROOT2');
		});
	});

	describe('generate()', function() {
		it('folders are converted into start/end codes', async function() {
			let archive = new Archive();

			let file = new Archive.File();
			file.name = 'E1M1/THINGS';
			file.nativeSize = 22;
			file.getRaw = () => TestUtil.u8FromString('This is the first file');
			archive.files.push(file);

			file = new Archive.File();
			file.name = 'E1M1/BEHAVIOR';
			file.nativeSize = 23;
			file.getRaw = () => TestUtil.u8FromString('This is the second file');
			archive.files.push(file);

			file = new Archive.File();
			file.name = 'E1M2/LINEDEFS';
			file.nativeSize = 22;
			file.getRaw = () => TestUtil.u8FromString('This is the third file');
			archive.files.push(file);

			file = new Archive.File();
			file.name = 'E1M2/BLOCKMAP';
			file.nativeSize = 23;
			file.getRaw = () => TestUtil.u8FromString('This is the fourth file');
			archive.files.push(file);

			file = new Archive.File();
			file.name = 'ROOT';
			file.nativeSize = 22;
			file.getRaw = () => TestUtil.u8FromString('This is the first file');
			archive.files.push(file);

			file = new Archive.File();
			file.name = 'A/B/TEST';
			file.nativeSize = 23;
			file.getRaw = () => TestUtil.u8FromString('This is the second file');
			archive.files.push(file);

			file = new Archive.File();
			file.name = 'ROOT2';
			file.nativeSize = 22;
			file.getRaw = () => TestUtil.u8FromString('This is the third file');
			archive.files.push(file);

			const contentGenerated = handler.generate(archive);
			TestUtil.contentEqual(content.folders, contentGenerated);
		});

		it('maximum filename length is correct', function() {
			let archive = new Archive();
			let file = new Archive.File();

			let expectedName = 'AAAAAAAA';

			file.name = expectedName;
			file.nativeSize = 16;
			file.getRaw = () => TestUtil.u8FromString('longest filename');
			archive.files.push(file);

			const issues = handler.checkLimits(archive);
			assert.equal(issues.length, 0, `${issues.length} issues with archive, expected 0`);

			const contentGenerated = handler.generate(archive);

			const parsedArchive = handler.parse(contentGenerated);
			assert.ok(parsedArchive.files, 'Incorrect archive returned');
			assert.ok(parsedArchive.files[0], 'File did not get added to archive');
			assert.equal(parsedArchive.files[0].name, expectedName, 'Name does not match');

			// Again, this time with a name that's too long.
			archive = new Archive();

			expectedName = 'AA/TESTTEST1';

			file.name = expectedName;
			archive.files.push(file);
			const issues1 = handler.checkLimits(archive);
			assert.equal(issues1.length, 1, `${issues1.length} issues with archive, expected 1`);
		});

		it('maximum folder name length is correct', function() {
			let archive = new Archive();
			let file = new Archive.File();

			let expectedName = 'AA/TEST';

			file.name = expectedName;
			file.nativeSize = 16;
			file.getRaw = () => TestUtil.u8FromString('longest filename');
			archive.files.push(file);

			const issues = handler.checkLimits(archive);
			assert.equal(issues.length, 0, `${issues.length} issues with archive, expected 0`);

			const contentGenerated = handler.generate(archive);

			const parsedArchive = handler.parse(contentGenerated);
			assert.ok(parsedArchive.files, 'Incorrect archive returned');
			assert.ok(parsedArchive.files[0], 'File did not get added to archive');
			assert.equal(parsedArchive.files[0].name, expectedName, 'Name does not match');

			// Again, this time with a name that's too long.
			archive = new Archive();

			expectedName = 'AAA/TESTTEST';

			file.name = expectedName;
			archive.files.push(file);
			const issues1 = handler.checkLimits(archive);
			assert.equal(issues1.length, 1, `${issues1.length} issues with archive, expected 1`);
		});
	});
});
