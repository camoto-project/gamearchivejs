/*
 * Test helper functions.
 *
 * Copyright (C) 2010-2021 Adam Nielsen <malvineous@shikadi.net>
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

import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

export default class TestUtil {
	constructor(idHandler) {
		assert.ok(idHandler, 'Format handler ID must be specified');
		this.idHandler = idHandler;
	}

	loadData(filename) {
		const buffer = fs.readFileSync(filename);
		let ab = new ArrayBuffer(buffer.length);
		let u8 = new Uint8Array(ab);
		u8.set(buffer);

		// Save the filename for later use.
		u8.filename = filename;

		return u8;
	}

	// Load files from within a format-specific folder in the test directory,
	// defaulting to a .bin extension but falling back to any other extension.
	loadContent(handler, ids) {
		let content = {};
		for (const name of ids) {
			// Read <name>.bin if present, otherwise look for <name>.*
			const pathFiles = path.resolve(__dirname, this.idHandler);
			const files = fs.readdirSync(pathFiles);
			let targetName;
			if (files.includes(name + '.bin')) {
				targetName = name + '.bin';
			} else {
				const target = files.filter(f => f.startsWith(name + '.'));
				assert.ok(target.length === 1, `Expected only one file: ${this.idHandler}/${name}.*`);
				targetName = target[0];
			}

			const mainFilename = path.join(__dirname, this.idHandler, targetName);
			let input = {
				main: this.loadData(mainFilename),
			};

			const suppList = handler && handler.supps(mainFilename, input.main);
			if (suppList) {
				for (const [id, suppFilename] of Object.entries(suppList)) {
					input[id] = this.loadData(suppFilename); // already includes full path
				}
			}

			content[name] = input;
		}

		return content;
	}

	// Load files from within a format-specific folder in the test directory,
	// using exactly the filename given.
	loadDirect(handler, ids) {
		let content = {};
		for (const targetName of ids) {
			let input = {};

			const mainFilename = path.join(__dirname, this.idHandler, targetName);
			try {
				input.main = this.loadData(mainFilename);
			} catch (e) {
				throw new Error(`Unable to open ${mainFilename}.`);
			}

			let lastSuppFilename;
			try {
				const suppList = handler && handler.supps(mainFilename, input.main);
				if (suppList) {
					for (const [id, suppFilename] of Object.entries(suppList)) {
						lastSuppFilename = suppFilename;
						input[id] = this.loadData(suppFilename); // already includes full path
					}
				}
			} catch (e) {
				throw new Error(`Unable to open supp file ${lastSuppFilename}.`);
			}

			content[targetName] = input;
		}

		return content;
	}

	static buffersEqual(expected, actual, msg) {
		const errorFilename = path.resolve(__dirname, expected.filename || 'error');

		if (expected instanceof ArrayBuffer) {
			expected = new Uint8Array(expected);
		}
		if (!arrayEqual(expected, actual)) {
			if (process.env.SAVE_FAILED_TEST == 1) {
				let fn = errorFilename + '.failed_test_output';
				// eslint-disable-next-line no-console
				console.warn(`** Saving actual data to ${fn}`);
				fs.writeFileSync(fn, actual);
			}

			throw new assert.AssertionError({
				message: 'Buffers are not equal' + (msg ? ': ' + msg : ''),
				expected: hexdump(expected),
				actual: hexdump(actual),
			});
		}
	}

	static contentEqual(contentExpected, contentActual) {
		Object.keys(contentExpected).forEach(id => {
			this.buffersEqual(contentExpected[id], contentActual[id]);
		});
	}

	static u8FromString(s) {
		return Uint8Array.from(s.split(''), s => s.charCodeAt(0));
	}

	static hash(content) {
		return crypto
			.createHash('sha1')
			.update(content)
			.digest('base64');
	}
}
