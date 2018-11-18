/**
 * @file Command line interface to the library.
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

const fs = require('fs');
const commandLineArgs = require('command-line-args');
const GameArchive = require('../index.js');
const Debug = require('../util/utl-debug.js');

// https://stackoverflow.com/a/20732091/308237
function humanFileSize(size) {
	let i = (size == 0) ? 0 : Math.floor(Math.log(size) / Math.log(1024));
	return (size / Math.pow(1024, i)).toFixed(1) * 1 + '' + ['', 'k', 'M', 'G', 'T'][i];
}

class OperationsError extends Error {
}

class Operations
{
	constructor() {
		this.archive = new GameArchive.Archive();
	}

	log(action, ...params) {
		console.log(action.padStart(12) + ':', ...params);
	}

	async add(params) {
		let file = new GameArchive.Archive.File();
		file.name = params.name || params.target;
		file.getRaw = () => fs.readFileSync(params.target);
		this.archive.files.push(file);
		this.log('adding', params.name || params.target,
			params.name ? '(from ' + params.target + ')' : '');
	}

	del(params) {
		const targetName = params.target.toUpperCase(); // nearly always ASCII
		for (let i = 0; i < this.archive.files.length; i++) {
			if (this.archive.files[i].name.toUpperCase() == targetName) {
				this.log('deleting', this.archive.files[i].name);
				delete this.archive.files[i];
				return;
			}
		}
		throw new OperationsError(`del: archive does not contain "${params.target}"`);
	}

	async extract(params) {
		if (!params.target) {
			throw new OperationsError('extract: missing filename');
		}

		const targetName = params.target.toUpperCase(); // nearly always ASCII
		const targetFile = this.archive.files.find(file => file.name.toUpperCase() == targetName);
		if (!targetFile) {
			throw new OperationsError(`extract: archive does not contain "${params.target}"`);
		}
		let data;
		if (params.raw) {
			data = targetFile.getRaw();
		} else {
			data = targetFile.getContent();
		}
		this.log('extracting', params.target, params.name ? 'as ' + params.name : '');
		return fs.writeFile(params.name || params.target, data);
	}

	identify(params) {
		if (!params.target) {
			throw new OperationsError('identify: missing filename');
		}
		Debug.mute(false);

		console.log('Autodetecting file format...');
		let content = fs.readFileSync(params.target);
		let handlers = GameArchive.findHandler(content);

		console.log(handlers.length + ' format handler(s) matched');
		if (handlers.length === 0) {
			console.log('No file format handlers were able to identify this file format, sorry.');
			return;
		}
		handlers.forEach(handler => {
			const m = handler.metadata();
			console.log(`\n>> Trying handler for ${m.id} (${m.title})`);

			const tempArch = handler.parse(content);
			console.log(' - Handler reports archive contains', tempArch.files.length, 'files.');
			if (tempArch.files.length > 0) {
				console.log(' - First filename is:', tempArch.files[0].name);
				if (tempArch.files.length > 1) {
					console.log(' - Second filename is:', tempArch.files[1].name);
				}
			}
		});

		Debug.mute(true);
	}

	list() {
		let totalDiskSize = 0, totalNativeSize = 0;

		this.archive.files.forEach(file => {
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
						+ ' ' + (file.name || '-').padEnd(32)
						+ (file.type || '-').padEnd(16)
						+ (file.lastModified ? file.lastModified.toISOString().split('.')[0] : '')
			;
			console.log(str);

			totalDiskSize += file.diskSize;
			totalNativeSize += file.nativeSize;
		});

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
			handler = GameArchive.getHandler(params.format);
			if (!handler) {
				throw new OperationsError('Invalid format code: ' + params.format);
			}
		}
		if (!params.target) {
			throw new OperationsError('open: missing filename');
		}

		let content = fs.readFileSync(params.target);
		if (!handler) {
			let handlers = GameArchive.findHandler(content);
			if (handlers.length === 0) {
				throw new OperationsError('Unable to identify this archive format.');
			}
			if (handlers.length > 1) {
				console.error('This file format could not be unambiguously identified.  It could be:');
				handlers.forEach(h => {
					const m = h.metadata();
					console.error(` * ${m.id} (${m.title})`);
				});
				throw new OperationsError('open: please use the -f option to specify the format.');
			}
			handler = handlers[0];
		}

		this.archive = handler.parse(content);
		this.origFormat = handler.metadata().id;
	}

	async save(params) {
		if (!params.target) {
			throw new OperationsError('save: missing filename');
		}
		if (!params.format) params.format = this.origFormat;

		const handler = GameArchive.getHandler(params.format);
		if (!handler) {
			throw new OperationsError('save: invalid format code: ' + params.format);
		}

		const problems = handler.checkLimits(this.archive);
		if (problems.length) {
			console.log('There are problems preventing the requested changes from taking place:\n');
			for (let i = 0; i < problems.length; i++) {
				console.log((i + 1).toString().padStart(2) + ': ' + problems[i]);
			}
			console.log('\nPlease correct these issues and try again.\n');
			throw new OperationsError('save: cannot save due to file format limitations.');
		}

		console.warn('Saving to', params.target, 'as', params.format);
		const outBuffer = handler.generate(this.archive);
		return fs.promises.writeFile(params.target, outBuffer);
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
		{ name: 'format', alias: 'f' },
		{ name: 'target', defaultOption: true },
	],
	save: [
		{ name: 'format', alias: 'f' },
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
	GameArchive.listHandlers().forEach(handler => {
		const md = handler.metadata();
		console.log(`${md.id}: ${md.title}`);
		if (md.params) Object.keys(md.params).forEach(p => {
			console.log(`  * ${p}: ${md.params[p]}`);
		});
	});
}

async function processCommands()
{
	let cmdDefinitions = [
		{ name: 'debug', type: Boolean },
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

	if (cmd.debug) Debug.mute(false);

	if (!cmd.name || cmd.help) {
		// No params, show help.
		console.log(`Use: gamearch --formats | [--debug] [command1 [command2...]]

Commands:

  add [-n name] <file>
    Append <file> to archive, storing it as <name>.

  del | rm <file>
    Remove <file> from archive.

  extract [-n name] [-r] <file>
    Extract <file> from archive and save into current directory as <name>.  File
    is decompressed and decrypted as needed, unless -r is given.

  identify <file>
    Read local <file> and try to work out what archive format it is in.

  list | ls | dir
    Show all files in current archive.  Each line is:

      <attr> <decompressed size> -> <compressed size> <filename>

      attr: c = compressed, C = not compressed, - = not specified/supported
            e = encrypted,  E = not encrypted,  - = not specified/supported

  open [-f format] <file>
    Open the local <file> as an archive, autodetecting the format unless -f is
    given.  Use --formats for a list of possible values.  If other commands are
    used without 'open', a new empty archive is used.

  save [-f format] <file>
    Save the current archive to local <file> in the given <format>.  -f defaults
    to the value previously used by 'open', so it can be omitted when modifying
    existing archive files.  Archives are written from memory, so the same file
    can be passed to 'open' and then 'save' without issue.

  type | cat <file>
    Display contents of <file> inside archive on stdout after any decompression
    or decryption.

Examples:

  gamearch open duke3d.grp extract stalker.mid
  gamearch add stalker.mid save -f arc-grp-build music.grp
`);
		return;
	}

	let proc = new Operations();
	//	while (argv.length > 2) {
	while (cmd.name) {
		const def = Operations.names[cmd.name];
		if (def) {
			const runOptions = commandLineArgs(def, { argv, stopAtFirstUnknown: true });
			argv = runOptions._unknown || [];
			try {
				proc[cmd.name](runOptions);
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

processCommands();
