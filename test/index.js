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
file.getRaw = () => Buffer.from('This is the first file');
defaultArchive.files.push(file);

file = new Archive.File();
file.name = 'TWO.TXT';
file.getRaw = () => Buffer.from('This is the second file');
defaultArchive.files.push(file);

file = new Archive.File();
file.name = 'THREE.TXT';
file.getRaw = () => Buffer.from('This is the third file');
defaultArchive.files.push(file);

file = new Archive.File();
file.name = 'FOUR.TXT';
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
		});

	});
});
