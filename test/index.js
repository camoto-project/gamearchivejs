const assert = require('assert');
const fs = require('fs').promises;

const TestUtil = require('./util.js');
const GameArchive = require('../index.js');

// Override the default colours so we can actually see them
var colors = require('mocha/lib/reporters/base').colors;
colors['diff added'] = '1;33';
colors['diff removed'] = '1;31';
colors['green'] = '1;32';
colors['fail'] = '1;31';
colors['error message'] = '1;31';
colors['error stack'] = '1;37';

// An archive with no content.
const emptyArchive = {
	metadata: {},
	files: [],
};

// This is what we expect the default archive in any given format to
// look like.
const defaultArchive = {
	metadata: {},
	files: [
		{
			name: 'ONE.TXT',
			getRaw: () => Buffer.from('This is the first file'),
		},
		{
			name: 'TWO.TXT',
			getRaw: () => Buffer.from('This is the second file'),
		},
		{
			name: 'THREE.TXT',
			getRaw: () => Buffer.from('This is the third file'),
		},
		{
			name: 'FOUR.TXT',
			getRaw: () => Buffer.from('This is the fourth file'),
		},
	],
};
// Calculate the file lengths automatically
defaultArchive.files.forEach(file => {
	file.diskSize = file.getRaw().length;
	file.nativeSize = 0;
});

GameArchive.listHandlers().forEach(handler => {
	const md = handler.metadata();
	let testutil = new TestUtil(md.id);

	describe(`Standard tests for ${md.title} [${md.id}]`, function() {
		let contentDefault, contentEmpty;
		it('should have test data present in the local filesystem', async function() {
			contentDefault = testutil.loadData('default.bin');
			//await fs.readFile(`${__dirname}/${md.id}/default.bin`);
			contentEmpty = testutil.loadData('empty.bin');
			//contentEmpty = await fs.readFile(`${__dirname}/${md.id}/empty.bin`);
		});

		describe('parse()', function() {
			let archive;

			it('should parse correctly', function() {
				archive = handler.parse(contentDefault);
			});

			it('should have the standard number of files', function() {
				assert.equal(archive.files.length, 4);
			});
		});

		describe('generate()', function() {
			it('should generate correctly', function() {
				const contentGenerated = handler.generate(defaultArchive);
				testutil.buffersEqual(contentDefault, contentGenerated);
			});

			it('empty archives can be produced', function() {
				const contentGenerated = handler.generate(emptyArchive);
				testutil.buffersEqual(contentEmpty, contentGenerated);
			});
		});
	});
});
