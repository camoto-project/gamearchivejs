/*
 * Command line interface to the library.
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

import Debug from '../util/debug.js';
const debug = Debug.extend('cli');

import fs from 'fs';
import commandLineArgs from 'command-line-args';
import minimatch from 'minimatch';
import {
	Archive,
	File,
	all as gamearchiveFormats,
	findHandler as gamearchiveFindHandler,
} from '../index.js';

// https://stackoverflow.com/a/20732091/308237
function humanFileSize(size) {
	if (size === undefined) return '?';
	if (size < 0) return '!!';
	let i = (size == 0) ? 0 : Math.floor(Math.log(size) / Math.log(1024));
	return (size / Math.pow(1024, i)).toFixed(1) * 1 + '' + ['', 'k', 'M', 'G', 'T'][i];
}

class OperationsError extends Error {
}

class Operations
{
	constructor() {
		this.archive = new Archive();
	}

	log(action, ...params) {
		console.log(action.padStart(12) + ':', ...params);
	}

	async add(params) {
		if (!params.target) {
			throw new OperationsError('add: missing filename');
		}
		let file = new File();
		file.name = params.name || params.target;
		file.diskSize = file.nativeSize = fs.statSync(params.target).size;
		file.getRaw = () => fs.readFileSync(params.target);
		this.archive.files.push(file);
		this.log('adding', params.name || params.target,
			params.name ? '(from ' + params.target + ')' : '');
	}

	attrib(params) {
		if (!params.target) {
			throw new OperationsError('attrib: missing filename');
		}
		const targetName = params.target.toUpperCase(); // nearly always ASCII
		for (let i = 0; i < this.archive.files.length; i++) {
			if (this.archive.files[i].name.toUpperCase() == targetName) {
				let desc = [];
				if (params.compressed === true) {
					this.archive.files[i].attributes.compressed = true;
					desc.push('compressed');
				}
				if (params.uncompressed === true) {
					this.archive.files[i].attributes.compressed = false;
					desc.push('uncompressed');
				}
				if (params.encrypted === true) {
					this.archive.files[i].attributes.encrypted = true;
					desc.push('encrypted');
				}
				if (params.unencrypted === true) {
					this.archive.files[i].attributes.encrypted = false;
					desc.push('unencrypted');
				}
				this.log('attrib', this.archive.files[i].name, '=>', desc.length ? desc.join(', ') : 'no change');
				return;
			}
		}
		throw new OperationsError(`attrib: archive does not contain "${params.target}"`);
	}

	del(params) {
		if (!params.target) {
			throw new OperationsError('del: missing filename');
		}
		const targetName = params.target.toUpperCase(); // nearly always ASCII
		for (let i = 0; i < this.archive.files.length; i++) {
			if (this.archive.files[i].name.toUpperCase() == targetName) {
				this.log('deleting', this.archive.files[i].name);
				this.archive.files.splice(i, 1);
				return;
			}
		}
		throw new OperationsError(`del: archive does not contain "${params.target}"`);
	}

	async extract(params) {
		if (!params.target) {
			throw new OperationsError('extract: missing filename');
		}

		let targetFiles = [];
		for (let i = 0; i < this.archive.files.length; i++) {
			const file = this.archive.files[i];
			if (
				(
					(params.target[0] === '@')
					&& (minimatch(`@${i}`, params.target))
				) || (
					file.name
					&& minimatch(file.name, params.target, { matchBase: true, nocase: true })
				)
			) {
				targetFiles.push({
					index: i,
					targetFile: file,
				});
			}
		}

		if (targetFiles.length === 0) {
			throw new OperationsError(`extract: archive does not contain any files `
				+ `that match "${params.target}"`);
		}
		if ((targetFiles.length > 1) && (params.name)) {
			throw new OperationsError(`extract: can't use -n with multiple files `
				+ `("${params.target}" matched ${targetFiles.length} files).`);
		}

		// True if every filename is in all-caps, false if any files have lowercase letters.
		const allFilesCaps = targetFiles.every(f => f.name && (f.name === f.name.toUpperCase()));

		let pExtractedFiles = [];
		for (const { index, targetFile } of targetFiles) {
			let data;
			if (params.raw) {
				data = targetFile.getRaw();
			} else {
				data = targetFile.getContent();
			}

			// Figure out what to write the filename as
			let outName;
			if (params.name) {
				outName = params.name;
			} else {
				outName = targetFile.name || `@${index}`;
				if (allFilesCaps) {
					outName = outName.toLowerCase();
				}
			}

			this.log('extracting', targetFile.name || `file ${index}`, (outName != targetFile.name) ? '-> ' + outName : '');
			pExtractedFiles.push(
				fs.promises.writeFile(outName, data)
			);
		}
		return await Promise.all(pExtractedFiles);
	}

	identify(params) {
		if (!params.target) {
			throw new OperationsError('identify: missing filename');
		}

		console.log('Autodetecting file format...');
		const content = {
			main: fs.readFileSync(params.target),
		};
		let handlers = gamearchiveFindHandler(content.main, params.target);

		console.log(handlers.length + ' format handler(s) matched');
		if (handlers.length === 0) {
			console.log('No file format handlers were able to identify this file format, sorry.');
			return;
		}
		for (const handler of handlers) {
			const m = handler.metadata();
			console.log(`\n>> Trying handler for ${m.id} (${m.title})`);

			try {
				const suppList = handler.supps(params.target, content.main);
				if (suppList) {
					for (const [id, suppFilename] of Object.entries(suppList)) {
						if (id === 'main') continue;
						try {
							content[id] = fs.readFileSync(suppFilename);
							content[id].filename = suppFilename;
						} catch (e) {
							throw new Error(`Unable to open supp file ${suppList[id]}:\n     ${e}`);
						}
					}
				}
			} catch (e) {
				console.log(` - Skipping format due to error loading additional files `
					+ `required:\n   ${e}`);
				continue;
			}

			const tempArch = handler.parse(content);
			console.log(' - Handler reports archive contains', tempArch.files.length, 'files.');
			if (tempArch.files.length > 0) {
				console.log(' - First filename is:', tempArch.files[0].name);
				if (tempArch.files.length > 1) {
					console.log(' - Second filename is:', tempArch.files[1].name);
				}
			}
		}
	}

	list() {
		let totalDiskSize = 0, totalNativeSize = 0;

		for (let i = 0; i < this.archive.files.length; i++) {
			const file = this.archive.files[i];

			const txt = (v, y, n) => (v === true) ? y : ((v === false) ? n : '-');
			let attr = txt(file.attributes.encrypted, 'e', 'E')
				+ txt(file.attributes.compressed, 'c', 'C');

			let size = '';
			if (file.attributes.compressed) {
				size += humanFileSize(file.nativeSize)/*.padStart(6)*/ + ' -> ';
			} else {
				size += ''.padStart(6) + '    ';
			}
			size += humanFileSize(file.diskSize);//.padStart(6);
			const str = attr + ' '
				+ size.padStart(16)
				+ ' ' + (file.name || `@${i}`).padEnd(32)
				+ (file.type || '-').padEnd(16)
				+ (file.lastModified ? file.lastModified.toISOString().split('.')[0] : '')
			;
			console.log(str);

			totalDiskSize += file.diskSize;
			totalNativeSize += file.nativeSize;
		}

		let size = '', ratio = '';
		if (totalNativeSize > 0) {
			size += humanFileSize(totalNativeSize) + ' -> ';
			ratio = ' (' + (100 - (totalDiskSize / totalNativeSize) * 100).toFixed(1) + '% compression)';
		}
		size += humanFileSize(totalDiskSize);
		const str = ' ' + this.archive.files.length + ' files, ' + size + ratio;
		console.log(str);
	}

	open(params) {
		let handler;
		if (params.format) {
			handler = gamearchiveFormats.find(h => h.metadata().id === params.format);
			if (!handler) {
				throw new OperationsError('Invalid format code: ' + params.format);
			}
		}
		if (!params.target) {
			throw new OperationsError('open: missing filename');
		}

		let content = {
			main: fs.readFileSync(params.target),
		};
		if (!handler) {
			let handlers = gamearchiveFindHandler(content.main, params.target);
			if (handlers.length === 0) {
				throw new OperationsError('Unable to identify this archive format.');
			}
			if (handlers.length > 1) {
				console.error('This file format could not be unambiguously identified.  It could be:');
				handlers.forEach(h => {
					const m = h.metadata();
					console.error(` * ${m.id} (${m.title})`);
				});
				throw new OperationsError('open: please use the -t option to specify the format.');
			}
			handler = handlers[0];
		}

		const suppList = handler.supps(params.target, content.main);
		if (suppList) {
			for (const [id, suppFilename] of Object.entries(suppList)) {
				if (id === 'main') continue;
				try {
					content[id] = fs.readFileSync(suppFilename);
					content[id].filename = suppFilename;
				} catch (e) {
					throw new OperationsError(`open: unable to open supplementary file `
						+ `"${suppFilename}": ${e.message}`);
				}
			}
		}

		try {
			this.archive = handler.parse(content);
		} catch (e) {
			debug(e);
			throw new OperationsError(`Unable to open file: ${e.message}`);
		}
		this.origFormat = handler.metadata().id;
	}

	async replace(params) {
		if (!params.target) {
			throw new OperationsError('replace: missing filename');
		}
		const target = params.name || params.target;
		const targetUC = target.toUpperCase();
		for (const file of this.archive.files) {
			if (file.name.toUpperCase() === targetUC) {
				// Found the file
				file.diskSize = file.nativeSize = fs.statSync(params.target).size;
				file.getContent = () => fs.readFileSync(params.target);
				this.log('replacing', target,
					params.name ? '(from ' + params.target + ')' : '');
				return;
			}
		}
		throw new OperationsError(`replace: unable to find "${target}" in the archive.`);
	}

	async save(params) {
		if (!params.target) {
			throw new OperationsError('save: missing filename');
		}
		if (!params.format) params.format = this.origFormat;

		const handler = gamearchiveFormats.find(h => h.metadata().id === params.format);
		if (!handler) {
			throw new OperationsError('save: invalid format code: ' + params.format);
		}

		const problems = handler.checkLimits(this.archive);
		if (problems.length) {
			console.log('There are problems with the files to save:\n');
			for (let i = 0; i < problems.length; i++) {
				console.log((i + 1).toString().padStart(2) + ': ' + problems[i]);
			}
			if (!params.force) {
				console.log('\nPlease correct these issues and try again.\n');
				throw new OperationsError('save: cannot save due to file format limitations.');
			}
		}

		console.warn('Saving to', params.target, 'as', params.format);
		let outContent;
		try {
			outContent = handler.generate(this.archive);
		} catch (e) {
			debug(e);
			throw new OperationsError(`Failed to generate archive: ${e.message}`);
		}

		let promises = [];
		const suppList = handler.supps(params.target, outContent.main);
		if (suppList) {
			for (const [id, suppFilename] of Object.entries(suppList)) {
				if (id === 'main') continue;
				console.warn(` - Saving supplemental file "${id}" to ${suppFilename}`);
				promises.push(
					fs.promises.writeFile(suppFilename, outContent[id])
				);
			}
		}
		promises.push(fs.promises.writeFile(params.target, outContent.main));

		return await Promise.all(promises);
	}

	type(params) {
		if (!params.target) {
			throw new OperationsError('type: missing filename');
		}

		const targetName = params.target.toUpperCase(); // nearly always ASCII
		const targetFile = this.archive.files.find(file => file.name.toUpperCase() == targetName);
		if (!targetFile) {
			throw new OperationsError(`type: archive does not contain "${params.target}"`);
		}
		const data = targetFile.getContent();
		process.stdout.write(data);
	}
}

Operations.names = {
	add: [
		{ name: 'name', alias: 'n' },
		{ name: 'target', defaultOption: true },
	],
	attrib: [
		{ name: 'compressed', alias: 'c', type: Boolean },
		{ name: 'encrypted', alias: 'e', type: Boolean },
		{ name: 'uncompressed', alias: 'C', type: Boolean },
		{ name: 'unencrypted', alias: 'E', type: Boolean },
		{ name: 'target', defaultOption: true },
	],
	del: [
		{ name: 'target', defaultOption: true },
	],
	extract: [
		{ name: 'name', alias: 'n' },
		{ name: 'raw', alias: 'r', type: Boolean },
		{ name: 'target', defaultOption: true },
	],
	identify: [
		{ name: 'target', defaultOption: true },
	],
	list: [],
	open: [
		{ name: 'format', alias: 't' },
		{ name: 'target', defaultOption: true },
	],
	replace: [
		{ name: 'name', alias: 'n' },
		{ name: 'target', defaultOption: true },
	],
	save: [
		{ name: 'force', alias: 'f', type: Boolean },
		{ name: 'format', alias: 't' },
		{ name: 'target', defaultOption: true },
	],
	type: [
		{ name: 'target', defaultOption: true },
	],
};

// Make some alises
const aliases = {
	list: ['dir', 'ls'],
	del: ['rm'],
	type: ['cat'],
};
Object.keys(aliases).forEach(cmd => {
	aliases[cmd].forEach(alias => {
		Operations.names[alias] = Operations.names[cmd];
		Operations.prototype[alias] = Operations.prototype[cmd];
	});
});

function listFormats()
{
	for (const handler of gamearchiveFormats) {
		const md = handler.metadata();
		console.log(`${md.id}: ${md.title}`);
		if (md.params) Object.keys(md.params).forEach(p => {
			console.log(`  * ${p}: ${md.params[p]}`);
		});
	}
}

async function processCommands()
{
	let cmdDefinitions = [
		{ name: 'help', type: Boolean },
		{ name: 'formats', type: Boolean },
		{ name: 'name', defaultOption: true },
	];
	let argv = process.argv;

	let cmd = commandLineArgs(cmdDefinitions, { argv, stopAtFirstUnknown: true });
	argv = cmd._unknown || [];

	if (cmd.formats) {
		listFormats();
		return;
	}

	if (!cmd.name || cmd.help) {
		// No params, show help.
		console.log(`Use: gamearch --formats | [command1 [command2...]]

Options:

  --formats
    List all available file formats.

Commands:

  add [-n name] <file>
    Append <file> to archive, storing it as <name>.  See 'replace' to overwrite.

  attrib [-c|-C][-e|-E] <file>
    Set single attribute for <file>, see 'list' command.

  del | rm <file>
    Remove <file> from archive.

  extract [-n name] [-r] <file>
    Extract <file> from archive and save into current directory as <name>.  File
    is decompressed and decrypted as needed, unless -r is given.  <file> can be
    a glob, e.g. '*' to extract all files.  Files can be extracted by index by
    putting an at-sign as the first character in the filename, e.g. '@0' will
    extract the first file.  Since '*' will not match any files in an archive
    with no filenames, use '@*' to extract every file by index.

  identify <file>
    Read local <file> and try to work out what archive format it is in.

  list | ls | dir
    Show all files in current archive.  Each line is:

      <attr> <decompressed size> -> <compressed size> <filename>

      attr: c = compressed, C = not compressed, - = not specified/supported
            e = encrypted,  E = not encrypted,  - = not specified/supported

  open [-t format] <file>
    Open the local <file> as an archive, autodetecting the format unless -t is
    given.  Use --formats for a list of possible values.  If other commands are
    used without 'open', a new empty archive is used.

  replace [-n name] <file>
    Overwrite an existing file in the archive with new content read from <file>.
    Will overwrite <name> if given, otherwise looks for <file>.  New file's
    content is filtered (compressed/encrypted) during save if overwriting a
    filtered file - use 'attrib' to change this if desired.

  save [-t format] <file>
    Save the current archive to local <file> in the given <format>.  -t defaults
    to the value previously used by 'open', so it can be omitted when modifying
    existing archive files.  Archives are written from memory, so the same file
    can be passed to 'open' and then 'save' without issue.

  type | cat <file>
    Display contents of <file> inside archive on stdout after any decompression
    or decryption.

Examples:

  gamearch open duke3d.grp extract '*.mid'
  gamearch add stalker.mid save -t arc-grp-build music.grp

  # The DEBUG environment variable can be used for troubleshooting.
  DEBUG='gamearchive:*' gamearch ...
`);
		return;
	}

	let proc = new Operations();
	//	while (argv.length > 2) {
	while (cmd.name) {
		const def = Operations.names[cmd.name];
		if (def) {
			let runOptions;
			try {
				runOptions = commandLineArgs(def, { argv, stopAtFirstUnknown: true });
			} catch (e) {
				console.error(`Error processing command line: ${e.message}`);
				process.exit(1);
			}
			argv = runOptions._unknown || [];
			try {
				await proc[cmd.name](runOptions);
			} catch (e) {
				if (e instanceof OperationsError) {
					console.error(e.message);
					process.exit(2);
				}
				throw e;
			}
		} else {
			console.error(`Unknown command: ${cmd.name}`);
			process.exit(1);
		}
		cmd = commandLineArgs(cmdDefinitions, { argv, stopAtFirstUnknown: true });
		argv = cmd._unknown || [];
	}
}

export default processCommands;
