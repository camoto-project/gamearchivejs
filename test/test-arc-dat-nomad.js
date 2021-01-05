/*
 * Extra tests for arc-dat-nomad.
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
import { arc_dat_nomad as handler, Archive, File } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'raw_image',
			]);
		});

		describe('parse()', function() {

			it('should correctly parse archive containing raw images', function() {
				let archive = handler.parse(content.raw_image);
				assert.equal(archive.files[0].name.toUpperCase(), 'RAWVGA.BIN');
				assert.equal(archive.files[0].attributes.hasPrefixWords, true);
				assert.equal(archive.files[0].attributes.uncompressedPrefixWords.width, 16);
				assert.equal(archive.files[0].attributes.uncompressedPrefixWords.height, 17);
			});

		}); // parse()

		describe('generate()', function() {

			it('should use uncompressed width/height prefix for raw image files', async function() {
				let archive = new Archive();

				let file = new File();
				file.name = 'RAWVGA.BIN';
				file.nativeSize = 272; // 16 cols * 17 rows, 1 byte per pixel
				file.attributes.compressed = false;
				file.attributes.hasPrefixWords = true;
				file.attributes.uncompressedPrefixWords = {
					width: 16,
					height: 17
				};
				file.getRaw = () => new Uint8Array(272).fill(0xAA);
				archive.files.push(file);

				const contentGenerated = handler.generate(archive);
				TestUtil.contentEqual(content.raw_image, contentGenerated);
			});

		}); // generate()

	}); // I/O

}); // Extra tests
