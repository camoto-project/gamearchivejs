/**
 * @file Extra tests for arc-dat-fast.
 *
 * Copyright (C) 2018 Adam Nielsen <malvineous@shikadi.net>
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

const format = 'arc-dat-fast';

const handler = GameArchive.getHandler(format);
const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	let content = {};
	before('load test data from local filesystem', function() {
		content = testutil.loadContent(handler, [
			'typecode',
			'rle',
		]);
	});

	describe('parse()', function() {
		it('type codes are converted into filenames', function() {
			let archive = handler.parse(content.typecode);
			assert.equal(archive.files[0].name.toLowerCase(), 'level1.mif');
			assert.equal(archive.files[1].name.toLowerCase(), 'level2.mif');
			assert.equal(archive.files[2].name.toLowerCase(), 'test.tbg');
			assert.equal(archive.files[3].name.toLowerCase(), 'audio.snd');
			assert.equal(archive.files[4].name.toLowerCase(), 'ega.pal');
		});

		it('RLE codes are parsed', function() {
			let archive = handler.parse(content.rle);
			const exp = [0x12, 0x90, 0x34, 0xFE, 0xFE, 0xFE, 0xFE, 0x56];
			TestUtil.buffersEqual(Uint8Array.from(exp), archive.files[0].getContent());
		});
	});

	describe('generate()', function() {
		it('filenames are converted into type codes', async function() {
			let archive = new Archive();

			let file = new Archive.File();
			file.name = 'level1.mif';
			file.nativeSize = 8;
			file.getRaw = () => TestUtil.u8FromString('content1');
			archive.files.push(file);

			file = new Archive.File();
			file.name = 'LEVEL2.MIF';
			file.nativeSize = 8;
			file.getRaw = () => TestUtil.u8FromString('content2');
			archive.files.push(file);

			file = new Archive.File();
			file.name = 'test.tbg';
			file.nativeSize = 8;
			file.getRaw = () => TestUtil.u8FromString('content3');
			archive.files.push(file);

			file = new Archive.File();
			file.name = 'audio.snd';
			file.nativeSize = 8;
			file.getRaw = () => TestUtil.u8FromString('content4');
			archive.files.push(file);

			file = new Archive.File();
			file.name = 'ega.pal';
			file.nativeSize = 8;
			file.getRaw = () => TestUtil.u8FromString('content5');
			archive.files.push(file);

			const contentGenerated = handler.generate(archive);
			TestUtil.contentEqual(content.typecode, contentGenerated);
		});

		it('RLE codes are generated', function() {
			let archive = new Archive();

			let file = new Archive.File();
			file.name = 'data.rle';
			file.nativeSize = 8;
			file.getRaw = () => Uint8Array.from([0x12, 0x90, 0x34, 0xFE, 0xFE, 0xFE, 0xFE, 0x56]);
			archive.files.push(file);

			const contentGenerated = handler.generate(archive);
			TestUtil.contentEqual(content.rle, contentGenerated);
		});
	});
});
