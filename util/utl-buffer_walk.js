module.exports = class BufferWalk
{
	constructor(buffer) {
		this.buffer = buffer;
		this.pos = 0;
	}

	// negative will seek from EOF
	seekAbs(offset) {
		if (offset < 0) {
			this.pos = this.buffer.length + offset;
		} else {
			this.pos = offset;
		}
	}

	seekRel(offset) {
		this.pos += offset;
		this.pos = Math.max(this.pos, 0);
		this.pos = Math.min(this.pos, this.buffer.length);
	}

	getPos() {
		return this.pos;
	}

	distFromEnd() {
		return this.buffer.length - this.pos;
	}

	readRecord(rec) {
		let out = {};
		Object.keys(rec).forEach(k => {
			if (!rec[k]) {
				const msg = `Unable to read record as element "${k}" is an undefined type.`;
				console.error(msg);
				throw msg;
			}
			out[k] = rec[k].read(this);
			this.pos += rec[k].len;
		});
		return out;
	}

	sliceBlock(offset, len) {
		return this.buffer.slice(offset, offset + len);
	}
};
