/*
 * Extra tests for arc-gamemaps-id.
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
import { arc_gamemaps_id as handler, Archive, File } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	describe('I/O', function() {
		let content = {};

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'short',
				'wrong_sig',
				'plane1',
				'plane2',
				'tileinfo',
			]);
		});

		describe('identify()', function() {

			it('should reject short files', function() {
				const result = handler.identify(
					content['short'].main,
					content['short'].main.filename
				);
				assert.equal(result.reason, 'Content too short (< 8 b).');
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

		}); // identify()

		describe('parse()', function() {

			it('1-plane files are read', function() {
				let archive = handler.parse(content.plane1);
				assert.equal(archive.files.length, 101);
				assert.equal(archive.files[0].name.toLowerCase(), '00/plane0');
				assert.equal(archive.files[1].name.toLowerCase(), '00/info');
			});

			it('2-plane files are read', function() {
				let archive = handler.parse(content.plane2);
				assert.equal(archive.files.length, 102);
				assert.equal(archive.files[0].name.toLowerCase(), '00/plane0');
				assert.equal(archive.files[1].name.toLowerCase(), '00/plane1');
				assert.equal(archive.files[2].name.toLowerCase(), '00/info');
			});

			it('tileinfo is read', function() {
				let archive = handler.parse(content.tileinfo);
				assert.equal(archive.files.length, 102);
				assert.equal(archive.files[0].name.toLowerCase(), '00/plane0');
				assert.equal(archive.files[1].name.toLowerCase(), '00/info');
				assert.equal(archive.files[101].name.toLowerCase(), 'tileinfo');

				TestUtil.buffersEqual(
					TestUtil.u8FromString('This is the tileinfo data'),
					archive.files[101].getContent()
				);
			});

		}); // parse()

		describe('generate()', function() {

			it('1-plane files are written', async function() {
				let archive = new Archive();

				let file = new File();
				file.name = '00/plane0';
				file.nativeSize = 8;
				file.getRaw = () => TestUtil.u8FromString('content1');
				archive.files.push(file);

				file = new File();
				file.name = '00/info';
				file.nativeSize = 20;
				file.getRaw = () => TestUtil.u8FromString('aabb1234567890123456');
				archive.files.push(file);

				const contentGenerated = handler.generate(archive);
				TestUtil.contentEqual(content.plane1, contentGenerated);
			});

			it('2-plane files are written', async function() {
				let archive = new Archive();

				let file = new File();
				file.name = '00/plane0';
				file.nativeSize = 8;
				file.getRaw = () => TestUtil.u8FromString('content1');
				archive.files.push(file);

				file = new File();
				file.name = '00/plane1';
				file.nativeSize = 8;
				file.getRaw = () => TestUtil.u8FromString('content2');
				archive.files.push(file);

				file = new File();
				file.name = '00/info';
				file.nativeSize = 20;
				file.getRaw = () => TestUtil.u8FromString('aabb1234567890123456');
				archive.files.push(file);

				const contentGenerated = handler.generate(archive);
				TestUtil.contentEqual(content.plane2, contentGenerated);
			});

			it('tileinfo is written', async function() {
				let archive = new Archive();

				let file = new File();
				file.name = '00/plane0';
				file.nativeSize = 8;
				file.getRaw = () => TestUtil.u8FromString('content1');
				archive.files.push(file);

				file = new File();
				file.name = '00/info';
				file.nativeSize = 20;
				file.getRaw = () => TestUtil.u8FromString('aabb1234567890123456');
				archive.files.push(file);

				file = new File();
				file.name = 'tileinfo';
				file.nativeSize = 25;
				file.getRaw = () => TestUtil.u8FromString('This is the tileinfo data');
				archive.files.push(file);

				const contentGenerated = handler.generate(archive);
				TestUtil.contentEqual(content.tileinfo, contentGenerated);
			});

		}); // generate()

	}); // I/O

}); // Extra tests
