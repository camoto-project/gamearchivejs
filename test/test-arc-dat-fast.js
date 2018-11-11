const assert = require('assert');
const fs = require('fs').promises;

const TestUtil = require('./util.js');
const GameArchive = require('../index.js');

const format = 'arc-dat-fast';

describe(`Extra tests for ${format}`, function() {
	let testutil = new TestUtil(format);
	const handler = GameArchive.getHandler(format);

	describe('parse()', function() {
		it('type codes are converted into filenames', function() {
			const content = testutil.loadData('typecode.bin');
			let archive = handler.parse(content);
			assert.equal(archive.files[0].name.toLowerCase(), 'level1.mif');
			assert.equal(archive.files[1].name.toLowerCase(), 'level2.mif');
			assert.equal(archive.files[2].name.toLowerCase(), 'test.tbg');
			assert.equal(archive.files[3].name.toLowerCase(), 'audio.snd');
			assert.equal(archive.files[4].name.toLowerCase(), 'ega.pal');
		});
	});

	describe('generate()', function() {
		it('filenames are converted into type codes', async function() {
			let contentExpected = testutil.loadData('typecode.bin');
			assert.notEqual(contentExpected, null);

			const archive = {
				metadata: {},
				files: [
					{
						name: 'level1.mif',
						getRaw: () => Buffer.from('content1'),
					},
					{
						name: 'LEVEL2.MIF',
						getRaw: () => Buffer.from('content2'),
					},
					{
						name: 'test.tbg',
						getRaw: () => Buffer.from('content3'),
					},
					{
						name: 'audio.snd',
						getRaw: () => Buffer.from('content4'),
					},
					{
						name: 'ega.pal',
						getRaw: () => Buffer.from('content5'),
					},
				],
			};
			// Calculate the file lengths automatically
			archive.files.forEach(file => {
				file.diskSize = file.getRaw().length;
				file.nativeSize = 0;
			});

			const contentGenerated = handler.generate(archive);
			testutil.buffersEqual(contentExpected, contentGenerated);
		});
	});
});
