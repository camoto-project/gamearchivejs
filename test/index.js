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

// This is what we expect the default archive in any given format to
// look like.
let defaultArchive = new Archive();

let file = new Archive.File();
file.name = 'ONE.TXT';
file.lastModified = new Date(1994, 11, 31, 12, 34, 56);
file.getRaw = () => Buffer.from('This is the first file');
defaultArchive.files.push(file);

file = new Archive.File();
file.name = 'TWO.TXT';
file.lastModified = new Date(2000, 11, 31, 12, 34, 56);
file.getRaw = () => Buffer.from('This is the second file');
defaultArchive.files.push(file);

file = new Archive.File();
file.name = 'THREE.TXT';
file.lastModified = new Date(1994, 11, 31, 12, 34, 56);
file.getRaw = () => Buffer.from('This is the third file');
defaultArchive.files.push(file);

file = new Archive.File();
file.name = 'FOUR.TXT';
file.lastModified = new Date(1994, 11, 31, 12, 34, 56);
file.getRaw = () => Buffer.from('This is the fourth file');
defaultArchive.files.push(file);

GameArchive.listHandlers().forEach(handler => {
	const md = handler.metadata();
	let testutil = new TestUtil(md.id);

	describe(`Standard tests for ${md.title} [${md.id}]`, function() {
		let content = {};

		before('load test data from local filesystem', function() {
			content.default = testutil.loadData('default.bin');
			content.empty = testutil.loadData('empty.bin');
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

			it('should parse correctly', function() {
				archive = handler.parse(content.default);
			});

			it('should have the standard number of files', function() {
				assert.equal(archive.files.length, 4);
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

		});

		describe('generate()', function() {

			it('should generate correctly', function() {
				const contentGenerated = handler.generate(defaultArchive);
				testutil.buffersEqual(content.default, contentGenerated);
			});

			it('empty archives can be produced', function() {
				const contentGenerated = handler.generate(emptyArchive);
				testutil.buffersEqual(content.empty, contentGenerated);
			});

			it('maximum filename length is correct', function() {
				let archive = new Archive();
				let file = new Archive.File();

				let expectedName;
				if (md.limits.maxFilenameLen >= 5) {
					expectedName = new String().padStart(md.limits.maxFilenameLen - 5, 'A') + '.BBB';
				} else {
					// Not enough space for an extension so leave it off
					expectedName = new String().padStart(md.limits.maxFilenameLen, 'A');
				}
				file.name = expectedName;

				file.getRaw = () => Buffer.from('longest filename');
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
				file.getRaw = () => Buffer.from('test1');
				archive.files.push(file);

				file = new Archive.File();
				file.name = 'TEST2';
				file.getRaw = () => Buffer.from('test2');
				archive.files.push(file);

				const contentGenerated = handler.generate(archive);

				const parsedArchive = handler.parse(contentGenerated);
				assert.ok(parsedArchive.files, 'Incorrect archive returned');
				assert.ok(parsedArchive.files[0], 'First file did not get added to archive');
				assert.equal(parsedArchive.files[0].name.toUpperCase(), 'TEST1', 'Name does not match');

				assert.ok(parsedArchive.files[1], 'Second file did not get added to archive');
				assert.equal(parsedArchive.files[1].name.toUpperCase(), 'TEST2', 'Name does not match');
			});
		});

	});
});
