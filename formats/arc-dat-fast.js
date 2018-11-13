const { RecordBuffer, RecordType } = require('@malvineous/record-io-buffer');

const ArchiveHandler = require('./archiveHandler.js');
const Archive = require('./archive.js');
const Debug = require('../util/utl-debug.js');

const FORMAT_ID = 'arc-dat-fast';

const recordTypes = {
	fatEntry: {
		typeCode: RecordType.int.u16le,
		diskSize: RecordType.int.u16le,
		name: RecordType.string.fixed.nullTerm(31),
		nativeSize: RecordType.int.u16le,
	},
};

const FATENTRY_LEN = 37; // sizeof(fatEntry)

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

module.exports = class Archive_DAT_FAST extends ArchiveHandler
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'F.A.S.T. Data File',
			glob: [
				'*.dat',
			],
		};
	}

	static identify(content) {
		try {
			Debug.push(FORMAT_ID, 'identify');

			let buffer = new RecordBuffer(content);

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
					Debug.log(`File ${i} contains invalid char [${file.name}] => false`);
					return false;
				}
				if (buffer.distFromEnd() < file.diskSize) {
					// This file apparently goes past the end of the archive
					Debug.log(`File ${i} would go past EOF => false`);
					return false;
				}
				buffer.seekRel(file.diskSize);
			}
			// Too many files
			Debug.log(`Too many files => false`);
			return false;

		} finally {
			Debug.pop();
		}
	}

	static parse(content) {
		let archive = new Archive();

		let buffer = new RecordBuffer(content);

		let nextOffset = FATENTRY_LEN;
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
			nextOffset += file.diskSize + FATENTRY_LEN;
			buffer.seekRel(file.diskSize);
		}

		return archive;
	}

	static generate(archive)
	{
		// Calculate the size up front so we don't have to keep reallocating
		// the buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + b.diskSize,
			FATENTRY_LEN * archive.files.length
		);

		let buffer = new RecordBuffer(finalSize);

		archive.files.forEach(file => {
			const entry = {...file};
			entry.typeCode = 32;
			const ext = entry.name.substr(-4).toLowerCase();
			if (ext === '.snd') { // special case
				entry.typeCode = 8;
				// extension isn't removed
			} else {
				Object.keys(FASTTypes).some(typeCode => {
					if (FASTTypes[typeCode][0] === '') return false;
					if (ext === FASTTypes[typeCode][0]) {
						entry.typeCode = typeCode;
						// Remove filename extension
						entry.name = entry.name.substr(0, entry.name.length-4);
						return true;
					}
					return false; // keep going
				});
			}
			buffer.writeRecord(recordTypes.fatEntry, entry);
			buffer.put(file.getRaw());
		});

		return buffer.getBuffer();
	}

};
