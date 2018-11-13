const { BufferWalk, GrowableBuffer, RecordType } = require('@malvineous/record-io-buffer');
const GameCompression = require('@malvineous/gamecomp');

const ArchiveHandler = require('./archiveHandler.js');
const Archive = require('./archive.js');
const Debug = require('../util/utl-debug.js');

const FORMAT_ID = 'arc-rff-blood';

const recordTypes = {
	header: {
		signature: RecordType.string.fixed.withNulls(4),
		version: RecordType.int.u16le,
		pad: RecordType.int.u16le,
		fatOffset: RecordType.int.u32le,
		fileCount: RecordType.int.u32le,
		pad2: RecordType.string.fixed.withNulls(16),
	},
	fatEntry: {
		cache: RecordType.string.fixed.withNulls(16),
		offset: RecordType.int.u32le,
		diskSize: RecordType.int.u32le,
		packedSize: RecordType.int.u32le,
		lastModified: RecordType.int.u32le,
		flags: RecordType.int.u8,
		ext: RecordType.string.fixed.optNullTerm(3),
		basename: RecordType.string.fixed.optNullTerm(8),
		id: RecordType.int.u32le,
	},
};

const HEADER_LEN = 32; // sizeof(header)
const FATENTRY_LEN = 48; // sizeof(fatEntry)

// Number of bytes encrypted from start of file
const RFF_FILE_CRYPT_LEN = 256;

const RFFFlags = {
	FILE_ENCRYPTED: 0x10,
};

class Archive_RFF_Blood extends ArchiveHandler
{
	static metadata() {
		const vFull = this.version();
		const vHigh = vFull >> 8;
		const vLow = vFull & 0xFF;
		return {
			id: FORMAT_ID + '-v' + vFull.toString(16),
			title: 'Monolith Resource File Format v' + vHigh + '.' + vLow,
			glob: [
				'*.rff',
			],
			limits: {
				maxFilenameLen: 12,
			},
		};
	}

	static identify(content) {
		try {
			const md = this.metadata();
			Debug.push(md.id, 'identify');

			let buffer = new BufferWalk(content);

			let header = buffer.readRecord(recordTypes.header);
			if (header.signature !== 'RFF\x1A') {
				Debug.log(`Wrong signature => false`);
				return false;
			}

			if (header.version != this.version()) {
				const vHigh = header.version >> 8;
				const vLow = header.version & 0xFF;
				Debug.log(`Unsupported RFF version ${vHigh}.${vLow} => false`);
				return false;
			}

			return true;

		} finally {
			Debug.pop();
		}
	}

	static parse(content) {
		try {
			const md = this.metadata();
			Debug.push(md.id, 'parse');

			let archive = new Archive();
			const lenArchive = content.length;


			let buffer = new BufferWalk(content);
			let header = buffer.readRecord(recordTypes.header);

			Debug.log(`Contains ${header.fileCount} files, version 0x`
				+ header.version.toString(16));

			const crypto = this.getCrypto();
			let fat = buffer.sliceBlock(header.fatOffset, header.fileCount * FATENTRY_LEN);
			if (crypto) {
				fat = crypto.reveal(fat, {
					seed: header.fatOffset & 0xFF,
					offset: this.getKeyOffset_FAT(),
					limit: 0,
				});
			}
			fat = new BufferWalk(fat);

			for (let i = 0; i < header.fileCount; i++) {
				const file = fat.readRecord(recordTypes.fatEntry);
				if (file.offset > lenArchive) {
					Debug.log(`File #${i} (${file.name}) has offset `
						+ `${file.offset}, past archive EOF at ${lenArchive}`);
					console.error('Archive truncated, returning partial content');
					break;
				}
				file.nativeSize = 0; // uncompressed
				file.type = undefined;
				file.name = file.basename;
				file.attributes = {
					encrypted: false,
				};
				if (file.ext) file.name += '.' + file.ext;

				file.getRaw = () => buffer.sliceBlock(offset, file.diskSize);
				if (file.flags & RFFFlags.FILE_ENCRYPTED) {
					if (crypto) {
						file.getNative = () => {
							return crypto.reveal(file.getRaw(), {
								seed: 0,
								offset: this.getKeyOffset_File(),
								limit: RFF_FILE_CRYPT_LEN,
							});
						};
						file.attributes.encrypted = true;
					} else {
						Debug.log(`File #${i} is set to encrypted but this archive version doesn't support encryption`);
					}
				}
				archive.files.push(file);
			}

			return archive;

		} finally {
			Debug.pop();
		}
	}

	static generate(archive, params)
	{
		const xor = GameCompression.getHandler('enc-xor-blood');

		// Calculate the size up front so we don't have to keep reallocating
		// the buffer, improving performance.
		const fatOffset = archive.files.reduce(
			(a, b) => a + b.diskSize,
			HEADER_LEN
		);
		const lenFAT = archive.files.length * FATENTRY_LEN;
		const finalSize = fatOffset + lenFAT;

		const header = {
			signature: 'RFF\x1A',
			version: this.version(),
			pad: 0,
			fatOffset: fatOffset,
			fileCount: archive.files.length,
			pad2: '',
		};

		const crypto = this.getCrypto();

		let buffer = new GrowableBuffer(finalSize);
		buffer.writeRecord(recordTypes.header, header);
		let nextOffset = HEADER_LEN;

		let fat = new GrowableBuffer(lenFAT);

		archive.files.forEach(file => {
			let content = file.getRaw();

			let rffFile = {...file};
			rffFile.cache = '';
			rffFile.offset = nextOffset;
			rffFile.packedSize = 0;
			rffFile.flags = 0;
			if (!rffFile.id) rffFile.id = 0;
			[rffFile.basename, rffFile.ext] = file.name.split('.');

			if (crypto) {
				// If encryption hasn't been specifically disabled, then encrypt
				if (!file.attributes || (file.attributes.encrypted !== false)) {
					rffFile.flags |= RFFFlags.FILE_ENCRYPTED;
					content = crypto.obscure(content, {
						seed: 0,
						offset: this.getKeyOffset_File(),
						limit: RFF_FILE_CRYPT_LEN,
					});
				}
			}
			buffer.put(content);

			fat.writeRecord(recordTypes.fatEntry, rffFile);

			nextOffset += rffFile.diskSize;
		});

		// Write the FAT at the end, possibly encrypted
		if (crypto) {
			fat = crypto.obscure(fat.getBuffer(), {
				seed: header.fatOffset & 0xFF,
				offset: this.getKeyOffset_FAT(),
				limit: 0,
			});
		} else {
			fat = fat.getBuffer(); // for consistency
		}
		buffer.put(fat);

		return buffer.getBuffer();
	}

};

class Archive_RFF_Blood_v200 extends Archive_RFF_Blood
{
	static version() {
		return 0x200;
	}

	static getCrypto() {
		return null;
	}

	static getKeyOffset_File() {
		return 0;
	}

	static getKeyOffset_FAT() {
		return 0;
	}
};

class Archive_RFF_Blood_v300 extends Archive_RFF_Blood
{
	static version() {
		return 0x300;
	}

	static getCrypto() {
		return GameCompression.getHandler('enc-xor-blood');
	}

	static getKeyOffset_File() {
		// Even in v300 the files themselves were in the v301 format
		return 0;
	}

	static getKeyOffset_FAT() {
		return 1;
	}
};

class Archive_RFF_Blood_v301 extends Archive_RFF_Blood
{
	static version() {
		return 0x301;
	}

	static getCrypto() {
		return GameCompression.getHandler('enc-xor-blood');
	}

	static getKeyOffset_File() {
		return 0;
	}

	static getKeyOffset_FAT() {
		return 0;
	}
};

module.exports = [
	Archive_RFF_Blood_v200,
	Archive_RFF_Blood_v300,
	Archive_RFF_Blood_v301,
];
