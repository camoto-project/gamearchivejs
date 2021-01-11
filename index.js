/*
 * Main library interface.
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

import Debug from './util/debug.js';
const debug = Debug.extend('index');

import * as formats from './formats/index.js';

export * from './formats/index.js';
export { default as Archive } from './interface/archive.js';
export { default as File } from './interface/file.js';

/**
 * Get a list of all the available handlers.
 *
 * This is preferable to `import *` because most libraries also export utility
 * functions like the autodetection routine which would be included even though
 * they are not format handlers.
 */
export const all = [
	...Object.values(formats),
];

/**
 * Get a handler by examining the file content.
 *
 * @param {Uint8Array} content
 *   Archive file content.
 *
 * @param {string} filename
 *   Filename where `content` was read from.  This is required to identify
 *   formats where the filename extension is significant.  This can be
 *   omitted for less accurate autodetection.
 *
 * @return {Array<ArchiveHandler>} from formats/*.js that can handle the
 *   format, or an empty array if the format could not be identified.
 *
 * @example
 * import { findHandler as gamearchiveFindHandler } from '@camoto/gamearchive';
 * const content = fs.readFileSync('example.grp');
 * const handler = gamearchiveFindHandler(content, 'example.grp');
 * if (handler.length === 0) {
 *   console.log('Unable to identify file format.');
 * } else {
 *   const md = handler[0].metadata();
 *   console.log('File is in ' + md.id + ' format');
 * }
 */
export function findHandler(content, filename) {
	if (content.length === undefined) {
		throw new Error('content parameter must be Uint8Array');
	}
	let handlers = [];
	for (const x of all) {
		const metadata = x.metadata();
		debug(`Trying format handler ${metadata.id} (${metadata.title})`);
		const confidence = x.identify(content, filename);
		if (confidence.valid === true) {
			debug(`Matched ${metadata.id}: ${confidence.reason}`);
			handlers = [x];
			break;
		} else if (confidence.valid === undefined) {
			debug(`Possible match for ${metadata.id}: ${confidence.reason}`);
			handlers.push(x);
			// keep going to look for a better match
		} else {
			debug(`Not ${metadata.id}: ${confidence.reason}`);
		}
	}
	return handlers;
}
