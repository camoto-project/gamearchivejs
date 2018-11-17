const assert = require('assert');
const fs = require('fs').promises;

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
		content.typecode = testutil.loadData('typecode.bin');
		content.rle = testutil.loadData('rle.bin');
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
			testutil.buffersEqual(Buffer.from(exp), archive.files[0].getContent());
		});
	});

	describe('generate()', function() {
		it('filenames are converted into type codes', async function() {
			let archive = new Archive();

			let file = new Archive.File();
			file.name = 'level1.mif';
			file.getRaw = () => Buffer.from('content1');
			archive.files.push(file);

			file = new Archive.File();
			file.name = 'LEVEL2.MIF';
			file.getRaw = () => Buffer.from('content2');
			archive.files.push(file);

			file = new Archive.File();
			file.name = 'test.tbg';
			file.getRaw = () => Buffer.from('content3');
			archive.files.push(file);

			file = new Archive.File();
			file.name = 'audio.snd';
			file.getRaw = () => Buffer.from('content4');
			archive.files.push(file);

			file = new Archive.File();
			file.name = 'ega.pal';
			file.getRaw = () => Buffer.from('content5');
			archive.files.push(file);

			const contentGenerated = handler.generate(archive);
			testutil.buffersEqual(content.typecode, contentGenerated);
		});

		it('RLE codes are generated', function() {
			let archive = new Archive();

			let file = new Archive.File();
			file.name = 'data.rle';
			file.getRaw = () => Buffer.from([0x12, 0x90, 0x34, 0xFE, 0xFE, 0xFE, 0xFE, 0x56]);
			archive.files.push(file);

			const contentGenerated = handler.generate(archive);
			testutil.buffersEqual(content.rle, contentGenerated);
		});
	});
});
