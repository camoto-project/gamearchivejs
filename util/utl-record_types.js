const charset = {
	cp437: 'binary', // TODO: find a supported one
	utf8: 'utf8',
};

module.exports = {
	string: {
		fixed: {
			withNulls: len => ({
				read: bw => bw.buffer.toString(charset.cp437, bw.pos, bw.pos + len),
				write: (bw, val) => bw.buffer.write(val, bw.pos, Math.min(len, val.length), charset.cp437),
				len: len,
			}),

			nullTerm: len => ({
				read: bw => {
					const full = bw.buffer.toString(charset.cp437, bw.pos, bw.pos + len);
					let end = full.indexOf('\0', 0);
					if (end >= 0) {
						// Has a null embedded, end the string there
						return full.slice(0, end);
					}
					return full; // no null
				},
				write: (b, val) => {
					// The space we're writing into has already been zero-filled
					// so we can just write one char shorter than the max and
					// we'll always have a null-terminated string.
					b.buffer.write(val, b.pos, Math.min(len - 1, val.length), charset.cp437);
				},
				len: len, // always read same (fixed) length
			}),

			// Optional null-termination
			optNullTerm: len => ({
				read: bw => { // COPY of nullTerm.read
					const full = bw.buffer.toString(charset.cp437, bw.pos, bw.pos + len);
					let end = full.indexOf('\0', 0);
					if (end >= 0) {
						// Has a null embedded, end the string there
						return full.slice(0, end);
					}
					return full; // no null
				},
				write: (b, val) => {
					// The space we're writing into has already been zero-filled
					// so we can just write the max and if the string is shorter
					// the existing zero bytes will null-terminate it early.
					b.buffer.write(val, b.pos, Math.min(len, val.length), charset.cp437);
				},
				len: len, // always read same (fixed) length
			}),
		},
		variable: {
			// Read a null-terminated string, up to maxlen chars long.
			// Actual bytes read will be between 1 and maxlen.
			nullTerm: maxlen => ({
				read: bw => {
					let len = bw.buffer.indexOf(0, bw.pos);
					if (len < 0) len = maxlen; // missing terminating null
					return bw.buffer.toString(charset.cp437, bw.pos, bw.pos + len);
				},
				write: null,
				len: 0,
			}),
		},
	},
	char: (len, codepage) => ({
		read: bw => bw.buffer.toString(codepage || charset.cp437, bw.pos, bw.pos + len),
		write: null,
		len: len,
	}),
	int: {
		u8: {
			read: bw => bw.buffer.readUInt8(bw.pos),
			write: (bw, val) => bw.buffer.writeUInt8(val, bw.pos),
			len: 1,
		},
		u16le: {
			read: bw => bw.buffer.readUInt16LE(bw.pos),
			write: (bw, val) => bw.buffer.writeUInt16LE(val, bw.pos),
			len: 2,
		},
		u32le: {
			read: bw => bw.buffer.readUInt32LE(bw.pos),
			write: (bw, val) => bw.buffer.writeUInt32LE(val, bw.pos),
			len: 4,
		},
		s8: {
			read: bw => bw.buffer.readInt8(bw.pos),
			write: (bw, val) => bw.buffer.writeInt8(val, bw.pos),
			len: 1,
		},
		s16le: {
			read: bw => bw.buffer.readInt16LE(bw.pos),
			write: (bw, val) => bw.buffer.writeInt16LE(val, bw.pos),
			len: 2,
		},
		s32le: {
			read: bw => bw.buffer.readInt32LE(bw.pos),
			write: (bw, val) => bw.buffer.writeInt32LE(val, bw.pos),
			len: 4,
		},
	},
};
