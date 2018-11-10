const ArchiveHandler = require('./archive.js');
const BufferWalk = require('../util/utl-buffer_walk.js');
const GrowableBuffer = require('../util/utl-growable_buffer.js');
const Type = require('../util/utl-record_types.js');

const recordTypes = {
	header: {
		signature: Type.string.fixed.withNulls(12),
		fileCount: Type.int.u32le,
	},
	fatEntry: { // todo better name
		name: Type.string.fixed.optNullTerm(12),
		diskSize: Type.int.u32le,
	},
};

module.exports = class Archive_GRP_Build extends ArchiveHandler
{
	static metadata() {
		return {
			id: 'arc-grp-build',
			title: 'BUILD Group File',
			glob: [
				'*.grp',
			],
			limits: {
				maxFilenameLen: 12,
			},
		};
	}

	static identify(content) {
		let buffer = new BufferWalk(content);

		const sig = recordTypes.header.signature.read(buffer);
		if (sig === 'KenSilverman') return true;
		return false;
	}

	static parse(content) {
		let archive = {
			metadata: {},
			files: [],
		};

		let buffer = new BufferWalk(content);
		let header = buffer.readRecord(recordTypes.header);

		let nextOffset = 16 * (header.fileCount + 1);
		for (let i = 0; i < header.fileCount; i++) {
			const file = buffer.readRecord(recordTypes.fatEntry);
			let offset = nextOffset; // copy inside closure for f.get()
			archive.files.push({
				...file,
				nativeSize: 0, // uncompressed
				type: undefined,
				offset: offset,
				getRaw: () => buffer.sliceBlock(offset, file.diskSize),
			});
			nextOffset += file.diskSize;
		}

		return archive;
	}

	static generate(archive)
	{
		const header = {
			signature: 'KenSilverman',
			fileCount: archive.files.length,
		};

		// Calculate the size up front so we don't have to keep reallocating
		// the buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + b.diskSize,
			16 * (header.fileCount + 1)
		);

		let buffer = new GrowableBuffer(finalSize);
		buffer.writeRecord(recordTypes.header, header);

		archive.files.forEach(file => {
			buffer.writeRecord(recordTypes.fatEntry, file);
		});

		archive.files.forEach(file => {
			buffer.put(file.getRaw());
		});

		return buffer.getBuffer();
	}

};
