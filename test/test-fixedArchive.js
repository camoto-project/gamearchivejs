/*
 * Extra tests for fixedArchive.
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
import FixedArchive from '../util/fixedArchive.js';

let testutil = new TestUtil('fixedArchive');

describe(`fixedArchive`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = {
				default: testutil.loadData('default.bin'),
			};
		});

		describe('parse()', function() {

			it('should extract all files', function() {
				const files = [
					{
						name: 'one.txt',
						offset: 0,
						diskSize: 22,
						filter: null,
					}, {
						name: 'two.txt',
						diskSize: 23,
						filter: null,
					}, {
						name: 'three.txt',
						diskSize: 22,
						filter: null,
					}, {
						name: 'four.txt',
						diskSize: 23,
						filter: null,
					},
				];
				const archive = FixedArchive.parse(content['default'], files);

				assert.equal(archive.files[0].name, 'one.txt');
				assert.equal(archive.files[0].diskSize, 22);
				TestUtil.buffersEqual(TestUtil.u8FromString('This is the first file'), archive.files[0].getContent());

				assert.equal(archive.files[1].name, 'two.txt');
				assert.equal(archive.files[1].diskSize, 23);
				TestUtil.buffersEqual(TestUtil.u8FromString('This is the second file'), archive.files[1].getContent());

				assert.equal(archive.files[2].name, 'three.txt');
				assert.equal(archive.files[2].diskSize, 22);
				TestUtil.buffersEqual(TestUtil.u8FromString('This is the third file'), archive.files[2].getContent());

				assert.equal(archive.files[3].name, 'four.txt');
				assert.equal(archive.files[3].diskSize, 23);
				TestUtil.buffersEqual(TestUtil.u8FromString('This is the fourth file'), archive.files[3].getContent());
			});

			it('should extract files with gaps', function() {
				const files = [
					{
						name: 'two.txt',
						offset: 22,
						diskSize: 23,
						filter: null,
					}, {
						name: 'four.txt',
						offset: 67,
						diskSize: 23,
						filter: null,
					},
				];
				const archive = FixedArchive.parse(content['default'], files);

				assert.equal(archive.files[0].name, 'data1.bin');
				assert.equal(archive.files[0].diskSize, 22);
				TestUtil.buffersEqual(TestUtil.u8FromString('This is the first file'), archive.files[0].getContent());

				assert.equal(archive.files[1].name, 'two.txt');
				assert.equal(archive.files[1].diskSize, 23);
				TestUtil.buffersEqual(TestUtil.u8FromString('This is the second file'), archive.files[1].getContent());

				assert.equal(archive.files[2].name, 'data2.bin');
				assert.equal(archive.files[2].diskSize, 22);
				TestUtil.buffersEqual(TestUtil.u8FromString('This is the third file'), archive.files[2].getContent());

				assert.equal(archive.files[3].name, 'four.txt');
				assert.equal(archive.files[3].diskSize, 23);
				TestUtil.buffersEqual(TestUtil.u8FromString('This is the fourth file'), archive.files[3].getContent());
			});

			it('should handle final file as a gap', function() {
				const files = [
					{
						name: 'three.txt',
						offset: 45,
						diskSize: 22,
						filter: null,
					},
				];
				const archive = FixedArchive.parse(content['default'], files);

				assert.equal(archive.files[0].name, 'data1.bin');
				assert.equal(archive.files[0].diskSize, 45);
				TestUtil.buffersEqual(TestUtil.u8FromString('This is the first fileThis is the second file'), archive.files[0].getContent());

				assert.equal(archive.files[1].name, 'three.txt');
				assert.equal(archive.files[1].diskSize, 22);
				TestUtil.buffersEqual(TestUtil.u8FromString('This is the third file'), archive.files[1].getContent());

				assert.equal(archive.files[2].name, 'data2.bin');
				assert.equal(archive.files[2].diskSize, 23);
				TestUtil.buffersEqual(TestUtil.u8FromString('This is the fourth file'), archive.files[2].getContent());
			});

			it('should bail if files go past EOF', function() {
				const files = [
					{
						name: 'four.txt',
						offset: 67,
						diskSize: 24,
						filter: null,
					},
				];

				assert.throws(() => {
					FixedArchive.parse(content['default'], files);
				});
			});

		}); // parse()

		describe('generate()', function() {

			it('should handle all files with no gaps', function() {
				const files = [
					{
						name: 'one.txt',
						offset: 0,
						diskSize: 22,
						filter: null,
					}, {
						name: 'two.txt',
						diskSize: 23,
						filter: null,
					}, {
						name: 'three.txt',
						diskSize: 22,
						filter: null,
					}, {
						name: 'four.txt',
						diskSize: 23,
						filter: null,
					},
				];
				const archive = FixedArchive.parse(content['default'], files);

				const contentGenerated = FixedArchive.generate(archive);
				TestUtil.contentEqual(content['default'], contentGenerated);
			});

			it('should extract files with gaps', function() {
				const files = [
					{
						name: 'two.txt',
						offset: 22,
						diskSize: 23,
						filter: null,
					}, {
						name: 'four.txt',
						offset: 67,
						diskSize: 23,
						filter: null,
					},
				];
				const archive = FixedArchive.parse(content['default'], files);

				const contentGenerated = FixedArchive.generate(archive);
				TestUtil.contentEqual(content['default'], contentGenerated);
			});

		}); // generate()

	}); // I/O

}); // Extra tests
