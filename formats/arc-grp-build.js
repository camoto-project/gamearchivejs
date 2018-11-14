const { RecordBuffer, RecordType } = require('@malvineous/record-io-buffer');

const ArchiveHandler = require('./archiveHandler.js');
const Archive = require('./archive.js');
const Debug = require('../util/utl-debug.js');

const FORMAT_ID = 'arc-grp-build';

const recordTypes = {
	header: {
		signature: RecordType.string.fixed.withNulls(12),
		fileCount: RecordType.int.u32le,
	},
	fatEntry: {
		name: RecordType.string.fixed.optNullTerm(12),
		diskSize: RecordType.int.u32le,
	},
};

const FATENTRY_LEN = 16; // sizeof(fatEntry)

module.exports = class Archive_GRP_Build extends ArchiveHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'BUILD Group File',
			glob: [
				'*.grp',
			],
		};

		md.limits.maxFilenameLen = 12;

		return md;
	}

	static identify(content) {
		try {
			Debug.push(FORMAT_ID, 'identify');

			let buffer = new RecordBuffer(content);

			const sig = recordTypes.header.signature.read(buffer);
			if (sig === 'KenSilverman') return true;
			Debug.log(`Wrong signature => false`);
			return false;

		} finally {
			Debug.pop();
		}
	}

	static parse(content) {
		let archive = new Archive();
		const lenArchive = content.length;

		let buffer = new RecordBuffer(content);
		let header = buffer.readRecord(recordTypes.header);

		let nextOffset = FATENTRY_LEN * (header.fileCount + 1);
		for (let i = 0; i < header.fileCount; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);
			let offset = nextOffset; // copy inside closure for f.get()

			let file = new Archive.File();
			file.diskSize = fatEntry.compressedSize;
			file.offset = offset;
			file.getRaw = () => buffer.sliceBlock(offset, file.diskSize);

			archive.files.push(file);

			nextOffset += fatEntry.diskSize;
			if (nextOffset > lenArchive) {
				console.error('Archive truncated, returning partial content');
				break;
			}
		}

		return archive;
	}

	static generate(archive)
	{
		const header = {
			signature: 'KenSilverman',
			fileCount: archive.files.length,
		};

		// Work out where the FAT ends and the first file starts.
		const offEndFAT = FATENTRY_LEN * (header.fileCount + 1);

		// Calculate the size up front so we don't have to keep reallocating
		// the buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + b.diskSize,
			offEndFAT,
		);

		let buffer = new RecordBuffer(finalSize);
		buffer.writeRecord(recordTypes.header, header);

		// Write the files first so we can retrieve the sizes.
		buffer.seekAbs(offEndFAT);

		archive.files.forEach(file => {
			const content = file.getContent();
			file.diskSize = file.nativeSize = content.length;
			buffer.put(content);
		});

		buffer.seekAbs(FATENTRY_LEN * 1);

		archive.files.forEach(file => {
			buffer.writeRecord(recordTypes.fatEntry, file);
		});

		return buffer.getBuffer();
	}
};
