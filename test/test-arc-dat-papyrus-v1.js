/*
 * Extra tests for arc-dat-papyrus-v1.
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
import { arc_dat_papyrus_v1 as handler, Archive, File } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'raw_image',
				'short',
				'short_fat',
				'file_starts_past_eof',
				'file_ends_past_eof',
			]);
		});

		describe('identify()', function() {

			it('should reject short files', function() {
				const result = handler.identify(
					content['short'].main,
					content['short'].main.filename
				);
				assert.equal(result.reason, 'Content too short (< 2 b).');
				assert.equal(result.valid, false);
			});

			it('should reject truncated FAT', function() {
				const result = handler.identify(
					content['short_fat'].main,
					content['short_fat'].main.filename
				);
				assert.equal(result.reason, `Content too short for file count.`);
				assert.equal(result.valid, false);
			});

			it('should reject file that starts past archive EOF', function() {
				const result = handler.identify(
					content['file_starts_past_eof'].main,
					content['file_starts_past_eof'].main.filename
				);
				assert.equal(result.reason, 'File 3 @ offset 183 starts beyond the end of the archive.');
				assert.equal(result.valid, false);
			});

			it('should reject file that ends past archive EOF', function() {
				const result = handler.identify(
					content['file_ends_past_eof'].main,
					content['file_ends_past_eof'].main.filename
				);
				assert.equal(result.reason, 'File 3 ends beyond the end of the archive.');
				assert.equal(result.valid, false);
			});

		}); // identify()

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
