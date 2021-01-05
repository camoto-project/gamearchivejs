/**
 * @file Extra tests for arc-wad-doom.
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
import { arc_wad_doom as handler, Archive, File } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'short',
				'wrong_sig',
				'fat_past_eof',
				'folders',
				'folders_map',
			]);
		});

		describe('identify()', function() {

			it('should reject short files', function() {
				const result = handler.identify(
					content['short'].main,
					content['short'].main.filename
				);
				assert.equal(result.reason, 'Content too short (< 12 b).');
				assert.equal(result.valid, false);
			});

			it('should reject wrong signature', function() {
				const result = handler.identify(
					content['wrong_sig'].main,
					content['wrong_sig'].main.filename
				);
				assert.equal(result.reason, `Incorrect signature "FWAD".`);
				assert.equal(result.valid, false);
			});

			it('should reject FAT beyond EOF', function() {
				const result = handler.identify(
					content['fat_past_eof'].main,
					content['fat_past_eof'].main.filename
				);
				assert.equal(result.reason, `FAT offset (172) is past the end of the file (166).`);
				assert.equal(result.valid, false);
			});

		}); // identify()

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

		}); // parse()

		describe('generate()', function() {

			it('folders are converted into start/end codes (ExMx)', async function() {
				let archive = new Archive();

				let file = new File();
				file.name = 'E1M1/THINGS';
				file.nativeSize = 22;
				file.getRaw = () => TestUtil.u8FromString('This is the first file');
				archive.files.push(file);

				file = new File();
				file.name = 'E1M1/BEHAVIOR';
				file.nativeSize = 23;
				file.getRaw = () => TestUtil.u8FromString('This is the second file');
				archive.files.push(file);

				file = new File();
				file.name = 'E1M2/LINEDEFS';
				file.nativeSize = 22;
				file.getRaw = () => TestUtil.u8FromString('This is the third file');
				archive.files.push(file);

				file = new File();
				file.name = 'E1M2/BLOCKMAP';
				file.nativeSize = 23;
				file.getRaw = () => TestUtil.u8FromString('This is the fourth file');
				archive.files.push(file);

				file = new File();
				file.name = 'ROOT';
				file.nativeSize = 22;
				file.getRaw = () => TestUtil.u8FromString('This is the first file');
				archive.files.push(file);

				file = new File();
				file.name = 'A/B/TEST';
				file.nativeSize = 23;
				file.getRaw = () => TestUtil.u8FromString('This is the second file');
				archive.files.push(file);

				file = new File();
				file.name = 'ROOT2';
				file.nativeSize = 22;
				file.getRaw = () => TestUtil.u8FromString('This is the third file');
				archive.files.push(file);

				const contentGenerated = handler.generate(archive);
				TestUtil.contentEqual(content.folders, contentGenerated);
			});

			it('folders are converted into start/end codes (MAPxx)', async function() {
				let archive = new Archive();

				let file = new File();
				file.name = 'MAP01/THINGS';
				file.nativeSize = 22;
				file.getRaw = () => TestUtil.u8FromString('This is the first file');
				archive.files.push(file);

				file = new File();
				file.name = 'MAP01/BEHAVIOR';
				file.nativeSize = 23;
				file.getRaw = () => TestUtil.u8FromString('This is the second file');
				archive.files.push(file);

				file = new File();
				file.name = 'MAP02/LINEDEFS';
				file.nativeSize = 22;
				file.getRaw = () => TestUtil.u8FromString('This is the third file');
				archive.files.push(file);

				file = new File();
				file.name = 'MAP02/BLOCKMAP';
				file.nativeSize = 23;
				file.getRaw = () => TestUtil.u8FromString('This is the fourth file');
				archive.files.push(file);

				file = new File();
				file.name = 'ROOT';
				file.nativeSize = 22;
				file.getRaw = () => TestUtil.u8FromString('This is the first file');
				archive.files.push(file);

				file = new File();
				file.name = 'A/B/TEST';
				file.nativeSize = 23;
				file.getRaw = () => TestUtil.u8FromString('This is the second file');
				archive.files.push(file);

				file = new File();
				file.name = 'ROOT2';
				file.nativeSize = 22;
				file.getRaw = () => TestUtil.u8FromString('This is the third file');
				archive.files.push(file);

				const contentGenerated = handler.generate(archive);
				TestUtil.contentEqual(content.folders_map, contentGenerated);
			});

			it('maximum filename length is correct', function() {
				let archive = new Archive();
				let file = new File();

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
				let file = new File();

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

		}); // generate()

	}); // I/O

}); // Extra tests
