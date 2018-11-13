const assert = require('assert');
const fs = require('fs');
const path = require('path');

function hexdump(d) {
	let s = '', h = '', t = '';
	function addRow(i) {
		s += (i - 15).toString(16).padStart(6, '0') + '  ' + h + '  ' + t + "\n";
		h = t = '';
	}
	let i;
	for (i = 0; i < d.length; i++) {
		let v = d.readUInt8(i);
		h += v.toString(16).padStart(2, '0') + ' ';
		t += ((v < 32) || (v > 126)) ? '.' : String.fromCharCode(v);
		if (i % 16 === 15) {
			addRow(i);
		}
	}
	if (i % 16) {
		// Need to pad out the final row
		const end = d.length + 16 - (d.length % 16);
		for (; i < end; i++) {
			h += '   ';
		}
		addRow(i-1);
	}
	return s;
}

module.exports = class TestUtil {
	constructor(idHandler) {
		assert.ok(idHandler, 'Format handler ID must be specified');
		this.idHandler = idHandler;
	}

	buffersEqual(expected, actual, msg) {
		if ((expected.length != actual.length) || expected.compare(actual)) {
			if (process.env.SAVE_FAILED_TEST == 1) {
				for (let i = 1; i <= 20; i++) {
					const fn = `error${i}.bin`;
					if (!fs.existsSync(fn)) {
						console.warn(`** Saving actual data to ${fn}`);
						fs.writeFileSync(fn, actual);
						break;
					}
				}
			}

			throw new assert.AssertionError({
				message: 'Buffers are not equal' + (msg ? ': ' + msg : ''),
				expected: hexdump(expected),
				actual: hexdump(actual),
			});
		}
	}

	loadData(filename) {
		return fs.readFileSync(path.resolve(__dirname, this.idHandler, filename));
	}
};
