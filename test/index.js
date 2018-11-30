/**
 * @file Standard tests.
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

// Override the default colours so we can actually see them
var colors = require('mocha/lib/reporters/base').colors;
colors['diff added'] = '1;33';
colors['diff removed'] = '1;31';
colors['green'] = '1;32';
colors['fail'] = '1;31';
colors['error message'] = '1;31';
colors['error stack'] = '1;37';

// An archive with no content.
const emptyArchive = new Archive();

const allHandlers = GameArchive.listHandlers();
allHandlers.forEach(handler => {
	const md = handler.metadata();
	let testutil = new TestUtil(md.id);

	describe(`Standard tests for ${md.title} [${md.id}]`, function() {
		let content = {};
		let defaultArchive = new Archive();

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'default',
				'empty',
			]);

			// This is what we expect the default archive in any given format to
			// look like.

			let file = new Archive.File();
			file.name = 'ONE.TXT';
			file.lastModified = new Date(1994, 11, 31, 12, 34, 56);
			file.nativeSize = 22;
			file.getRaw = () => TestUtil.u8FromString('This is the first file');
			// default setting for compression, if supported
			// default setting for encryption, if supported
			defaultArchive.files.push(file);

			file = new Archive.File();
			file.name = 'TWO.TXT';
			file.lastModified = new Date(2000, 11, 31, 12, 34, 56);
			file.nativeSize = 23;
			file.getRaw = () => TestUtil.u8FromString('This is the second file');
			if (md.caps.file.attributes.compressed) {
				// Always compress this file, if supported
				file.attributes.compressed = true;
			}
			if (md.caps.file.attributes.encrypted) {
				// Always encrypt this file, if supported
				file.attributes.encrypted = true;
			}
			defaultArchive.files.push(file);

			file = new Archive.File();
			file.name = 'THREE.TXT';
			file.lastModified = new Date(1994, 11, 31, 12, 34, 56);
			file.diskSize = 64; // intentionally wrong size
			file.nativeSize = 22;
			file.getRaw = () => TestUtil.u8FromString('This is the third file');
			if (md.caps.file.attributes.compressed) {
				// Never compress this file, if supported
				file.attributes.compressed = false;
			}
			if (md.caps.file.attributes.encrypted) {
				// Never encrypt this file, if supported
				file.attributes.encrypted = false;
			}
			defaultArchive.files.push(file);

			file = new Archive.File();
			file.name = 'FOUR.TXT';
			file.lastModified = new Date(1994, 11, 31, 12, 34, 56);
			file.diskSize = 64; // intentionally wrong size
			file.nativeSize = 23;
			file.getRaw = () => TestUtil.u8FromString('This is the fourth file');
			// default setting for compression, if supported
			// default setting for encryption, if supported
			defaultArchive.files.push(file);
		});

		describe('metadata()', function() {

			it('should provide limits, even if empty', function() {
				assert.ok(md.limits);
			});

			it('should provide a filename glob, even if empty', function() {
				assert.ok(md.glob);
			});

			it('should provide a title', function() {
				assert.ok(md.title && (md.title.length > 0));
			});

			it('should provide a capability list', function() {
				// Make sure the metadata() implementation amends the objects rather
				// than replacing them entirely.
				assert.ok(md.caps);
				assert.ok(md.caps.file);
				assert.ok(md.caps.file.attributes);
			});

		});

		describe('parse()', function() {
			let archive;

			before('should parse correctly', function() {
				archive = handler.parse(content.default);
				assert.notStrictEqual(archive, undefined);
				assert.notStrictEqual(archive, null);
			});

			it('should have the standard number of files', function() {
				assert.equal(archive.files.length, 4);
			});

			it('should extract files correctly', function() {
				TestUtil.buffersEqual(TestUtil.u8FromString('This is the first file'), archive.files[0].getContent());
				TestUtil.buffersEqual(TestUtil.u8FromString('This is the second file'), archive.files[1].getContent());
				TestUtil.buffersEqual(TestUtil.u8FromString('This is the third file'), archive.files[2].getContent());
				TestUtil.buffersEqual(TestUtil.u8FromString('This is the fourth file'), archive.files[3].getContent());
			});

			it('should set the file size', function() {
				assert.equal(archive.files[0].nativeSize, 22);
				assert.equal(archive.files[1].nativeSize, 23);
				assert.equal(archive.files[2].nativeSize, 22);
				assert.equal(archive.files[3].nativeSize, 23);
			});

			if (md.caps.file.lastModified) {
				it('should set the last modified date', function() {
					assert.equal(archive.files[0].lastModified.getFullYear(), 1994, 'Wrong year');
					assert.equal(archive.files[0].lastModified.getMonth(), 11, 'Wrong month');
					assert.equal(archive.files[0].lastModified.getDate(), 31, 'Wrong day');
					assert.equal(archive.files[0].lastModified.getHours(), 12, 'Wrong hour');
					assert.equal(archive.files[0].lastModified.getMinutes(), 34, 'Wrong minute');
					assert.equal(archive.files[0].lastModified.getSeconds(), 56, 'Wrong second');
				});
			}

			describe('should not set any attributes unsupported by the format', function() {
				Object.keys(md.caps.file.attributes).forEach(attr => {
					if (md.caps.file.attributes[attr] === false) {
						it(`should not set the '${attr}' attribute`, function() {
							archive.files.forEach(file => {
								assert.equal(file.attributes[attr], undefined);
							});
						});
					}
				});
			});

			if (md.caps.file.attributes.compressed) {
				it('compression optional; should set attributes accordingly', function() {
					assert.equal(archive.files[1].attributes.compressed, true);
					assert.equal(archive.files[2].attributes.compressed, false);
				});
			}

			if (md.caps.file.attributes.encrypted) {
				it('encryption optional; should set attributes accordingly', function() {
					assert.equal(archive.files[1].attributes.encrypted, true);
					assert.equal(archive.files[2].attributes.encrypted, false);
				});
			}

		});

		describe('generate()', function() {

			it('should generate correctly', function() {
				const contentGenerated = handler.generate(defaultArchive);

				TestUtil.contentEqual(content.default, contentGenerated);
			});

			it('empty archives can be produced', function() {
				const contentGenerated = handler.generate(emptyArchive);

				TestUtil.contentEqual(content.empty, contentGenerated);
			});

			it('maximum filename length is correct', function() {
				let archive = new Archive();
				let file = new Archive.File();

				let expectedName;
				if (md.limits.maxFilenameLen >= 5) {
					expectedName = new String().padStart(md.limits.maxFilenameLen - 4, 'A') + '.BBB';
				} else {
					// Not enough space for an extension so leave it off
					expectedName = new String().padStart(md.limits.maxFilenameLen, 'A');
				}
				assert.equal(expectedName.length, md.limits.maxFilenameLen);

				file.name = expectedName;
				file.nativeSize = 16;
				file.getRaw = () => TestUtil.u8FromString('longest filename');
				archive.files.push(file);
				const contentGenerated = handler.generate(archive);

				const parsedArchive = handler.parse(contentGenerated);
				assert.ok(parsedArchive.files, 'Incorrect archive returned');
				assert.ok(parsedArchive.files[0], 'File did not get added to archive');
				assert.equal(parsedArchive.files[0].name, expectedName, 'Name does not match');
			});

			it('filenames without extensions work', function() {
				let archive = new Archive();

				let file = new Archive.File();
				file.name = 'TEST1';
				file.nativeSize = 5;
				file.getRaw = () => TestUtil.u8FromString('test1');
				archive.files.push(file);

				file = new Archive.File();
				file.name = 'TEST2';
				file.nativeSize = 5;
				file.getRaw = () => TestUtil.u8FromString('test2');
				archive.files.push(file);

				const contentGenerated = handler.generate(archive);

				const parsedArchive = handler.parse(contentGenerated);
				assert.ok(parsedArchive.files, 'Incorrect archive returned');
				assert.ok(parsedArchive.files[0], 'First file did not get added to archive');
				assert.equal(parsedArchive.files[0].name.toUpperCase(), 'TEST1', 'Name does not match');

				assert.ok(parsedArchive.files[1], 'Second file did not get added to archive');
				assert.equal(parsedArchive.files[1].name.toUpperCase(), 'TEST2', 'Name does not match');
			});

			it('inconsistent file lengths are detected', function() {
				let archive = new Archive();

				let file = new Archive.File();
				file.name = 'TEST1';
				file.nativeSize = 2;
				file.getRaw = () => TestUtil.u8FromString('test1');
				archive.files.push(file);

				assert.throws(() => {
					handler.generate(archive);
				});
			});

		});

		describe('identify()', function() {

			it('should not negatively identify itself', function() {
				const result = handler.identify(content.default.main);
				assert.ok(result === true || result === undefined);
			});

			it('should not negatively identify empty archives', function() {
				const result = handler.identify(content.empty.main);
				assert.ok(result === true || result === undefined);
			});

			const allHandlers = GameArchive.listHandlers();
			allHandlers.forEach(subhandler => {
				const submd = subhandler.metadata();

				// Skip ourselves
				if (submd.id === md.id) return;

				it(`should not positively identify ${submd.id} files`, function() {
					const result = subhandler.identify(content.default.main);
					assert.notEqual(result, true);
				});
			});
		});

	});
});
