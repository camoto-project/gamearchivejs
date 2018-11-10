module.exports = class GrowableBuffer
{
	constructor(initialSize) {
		this.buffer = Buffer.alloc(initialSize || 1048576);
		this.pos = 0;
	}

	writeRecord(rec, obj) {
		Object.keys(rec).forEach(k => {
			this.ensureFreeSpace(rec[k].len || 1048576);
			rec[k].write(this, obj[k]);
			this.pos += rec[k].len;
		});
	}

	/// Put the given data into the file and advance the pointer.
	/**
	 * @param Buffer buf
	 *   Source data to copy here.
	 *
	 * @return None.
	 *
	 * @postconditions The file pointer has been advanced by buf.length.
	 */
	put(buf) {
		this.ensureFreeSpace(buf.length);
		buf.copy(this.buffer, this.pos);
		this.pos += buf.length;
	}

	ensureFreeSpace(amt) {
		if (this.pos + amt > this.buffer.length) {
			//console.log('Enlarging buffer from', this.buffer.length, 'to', this.buffer.length + amt + 1048576, 'to fit extra', this.pos, '+', amt);
			let newBuf = Buffer.alloc(this.buffer.length + amt + 1048576);
			this.buffer.copy(newBuf);
			this.buffer = newBuf;
		}
	}

	getBuffer() {
		return this.buffer.slice(0, this.pos);
	}
};
