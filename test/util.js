/**
 * @file Test helper functions.
 *
 * Copyright (C) 2018 Adam Nielsen <malvineous@shikadi.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function hexdump(d) {
	let s = '', h = '', t = '';
	function addRow(i) {
		s += (i - 15).toString(16).padStart(6, '0') + '  ' + h + '  ' + t + '\n';
		h = t = '';
	}
	let i;
	for (i = 0; i < d.length; i++) {
		const v = d[i];
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

function arrayEqual(a, b) {
	if (a.length != b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] != b[i]) return false;
	}
	return true;
}

module.exports = class TestUtil {
	constructor(idHandler) {
		assert.ok(idHandler, 'Format handler ID must be specified');
		this.idHandler = idHandler;
	}

	loadData(filename) {
		const buffer = fs.readFileSync(path.resolve(__dirname, this.idHandler, filename));
		let ab = new ArrayBuffer(buffer.length);
		let u8 = new Uint8Array(ab);
		u8.set(buffer);
		return u8;
	}

	static buffersEqual(expected, actual, msg) {
		if (expected instanceof ArrayBuffer) {
			expected = new Uint8Array(expected);
		}
		if (!arrayEqual(expected, actual)) {
			if (process.env.SAVE_FAILED_TEST == 1) {
				for (let i = 1; i <= 20; i++) {
					const fn = `error${i}.bin`;
					if (!fs.existsSync(fn)) {
						// eslint-disable-next-line no-console
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

	static u8FromString(s) {
		return Uint8Array.from(s.split(''), s => s.charCodeAt(0));
	}
};
