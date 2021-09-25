/*
 * Extra tests for arc-cur-prehistorik.
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
import { arc_cur_prehistorik as handler, Archive, File } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'short',
				'fat_past_eof',
				'fat_too_small',
				'fat_trunc',
				'fat_extra',
				'file_past_eof',
				'fat_final_nonzero',
				'compressed_file',
			]);
		});

		describe('identify()', function() {

			it('should reject short files', function() {
				const result = handler.identify(
					content['short'].main,
					content['short'].main.filename
				);
				assert.equal(result.reason, 'Content too short (< 6 b).');
				assert.equal(result.valid, false);
			});

			it('should reject on FAT extending past EOF', function() {
				const result = handler.identify(
					content['fat_past_eof'].main,
					content['fat_past_eof'].main.filename
				);
				assert.equal(result.reason, `FAT truncated (file length 147 < FAT length 313).`);
				assert.equal(result.valid, false);
			});

			it('should reject on FAT length too small', function() {
				const result = handler.identify(
					content['fat_too_small'].main,
					content['fat_too_small'].main.filename
				);
				assert.equal(result.reason, `FAT length too small (5 < 6).`);
				assert.equal(result.valid, false);
			});

			it('should reject on truncated FAT', function() {
				const result = handler.identify(
					content['fat_trunc'].main,
					content['fat_trunc'].main.filename
				);
				assert.equal(result.reason, `FAT truncated at file 3.`);
				assert.equal(result.valid, false);
			});

			it('should reject on extra data after FAT', function() {
				const result = handler.identify(
					content['fat_extra'].main,
					content['fat_extra'].main.filename
				);
				assert.equal(result.reason, `1 extra bytes at the end of the FAT.`);
				assert.equal(result.valid, undefined);
			});

			it('should reject file past archive EOF', function() {
				const result = handler.identify(
					content['file_past_eof'].main,
					content['file_past_eof'].main.filename
				);
				assert.equal(result.reason, 'File 3 ends beyond the end of the archive.');
				assert.equal(result.valid, false);
			});

			it('should reject if final FAT entry size is not 0', function() {
				const result = handler.identify(
					content['fat_final_nonzero'].main,
					content['fat_final_nonzero'].main.filename
				);
				assert.equal(result.reason, 'Final FAT entry did not have a size of 0.');
				assert.equal(result.valid, false);
			});

		}); // identify()

		describe('reveal()', function() {

			it('files are decompressed', function() {
				let archive = handler.parse(content.compressed_file);
				const exp = [0x12, 0x34, 0x56, 0x12, 0x34, 0x56, 0x78, 0x9A];
				TestUtil.buffersEqual(Uint8Array.from(exp), archive.files[0].getContent());
			});

		}); // generate()

		describe('generate()', function() {

			it('files are compressed', function() {
				let archive = new Archive();

				let file = new File();
				file.name = 'test.mat';
				file.nativeSize = 8;
				file.getRaw = () => Uint8Array.from([0x12, 0x34, 0x56, 0x12, 0x34, 0x56, 0x78, 0x9A]);
				archive.files.push(file);

				const contentGenerated = handler.generate(archive);
				TestUtil.contentEqual(content.compressed_file, contentGenerated);
			});

		}); // generate()

	}); // I/O

}); // Extra tests
