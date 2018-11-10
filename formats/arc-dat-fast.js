const ArchiveHandler = require('./archive.js');
const BufferWalk = require('../util/utl-buffer_walk.js');
const GrowableBuffer = require('../util/utl-growable_buffer.js');
const Type = require('../util/utl-record_types.js');

const recordTypes = {
	fatEntry: {
		typeCode: Type.int.u16le,
		diskSize: Type.int.u16le,
		name: Type.string.fixed.nullTerm(31),
		nativeSize: Type.int.u16le,
	},
};

const FAT_HEADER_LEN = 37; // sizeof(fatEntry)

/// Safety limit, actual format is unlimited
const MAX_FILES = 1024;

const FASTTypes = {
	0: ['.mif', 'map/fast-info'],
	1: ['.mbg', 'map/fast-bg'],
	2: ['.mfg', 'map/fast-fg'],
	3: ['.tbg', 'tileset/fast-4p'],
	4: ['.tfg', 'tileset/fast-5p'],
	5: ['.tbn', 'tileset/fast-5p'],
	6: ['.sgl', 'map/fast-spritelist'],
	7: ['.msp', 'map/fast-sprites'],
	8: ['', 'sound/inverse'],
	12: ['.pbg', 'data/fast-tileprops'],
	13: ['.pfg', 'data/fast-tileprops'],
	14: ['.pal', 'palette/ega'],
	16: ['.pbn', 'data/fast-tileprops'],
	32: ['', undefined],
	64: ['.spr', 'image/fast-sprite'],
};

class Archive_DAT_FAST extends ArchiveHandler
{
	static metadata() {
		return {
			id: 'arc-dat-fast',
			title: 'F.A.S.T. Data File',
			glob: [
				'*.dat',
			],
		};
	}

	static identify(content) {
		let buffer = new BufferWalk(content);

		for (let i = 0; i < MAX_FILES; i++) {
			// If we're exactly at the EOF then we're done.
			if (buffer.distFromEnd() === 0) return true;
			const file = buffer.readRecord(recordTypes.fatEntry);
			if ([...file.name].some(c => {
				const cc = c.charCodeAt(0);
				return (cc <= 32) || (cc > 126);
			})) {
				// One or more filenames contain invalid chars, so they probably aren't
				// filenames.
				console.log(`File ${i} contains invalid char [${file.name}] => false`);
				return false;
			}
			if (buffer.distFromEnd() < file.diskSize) {
				// This file apparently goes past the end of the archive
				console.log(`File ${i} would go past EOF => false`);
				return false;
			}
			buffer.seekRel(file.diskSize);
		}
		// Too many files
		console.log(`Too many files => false`);
		return false;
	}

	static parse(content) {
		let archive = {
			metadata: {},
			files: [],
		};

		let buffer = new BufferWalk(content);

		let nextOffset = FAT_HEADER_LEN;
		for (let i = 0; i < MAX_FILES; i++) {
			// If we're exactly at the EOF then we're done.
			if (buffer.distFromEnd() === 0) break;
			// TODO: Handle trailing data less than a FAT entry in size
			const file = buffer.readRecord(recordTypes.fatEntry);
			let offset = nextOffset; // copy inside closure for f.get()
			const tc = FASTTypes[file.typeCode];
			if (tc) {
				file.name += tc[0];
				file.type = tc[1];
			} else {
				file.type = undefined;
			}
			archive.files.push({
				...file,
				offset: offset,
				getRaw: () => buffer.sliceBlock(offset, file.diskSize),
			});
			nextOffset += file.diskSize + FAT_HEADER_LEN;
			buffer.seekRel(file.diskSize);
		}

		return archive;
	}

	static generate(files)
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

module.exports = Archive_DAT_FAST;
