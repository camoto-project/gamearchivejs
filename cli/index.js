const fs = require('fs').promises;
const commandLineArgs = require('command-line-args');
const GameArchive = require('../index.js');
const Debug = require('../util/utl-debug.js');

// https://stackoverflow.com/a/20732091/308237
function humanFileSize(size) {
	let i = (size == 0) ? 0 : Math.floor(Math.log(size) / Math.log(1024));
	return (size / Math.pow(1024, i)).toFixed(1) * 1 + '' + ['', 'k', 'M', 'G', 'T'][i];
};

class OperationsError extends Error {
};

class Operations
{
	constructor() {
		this.archive = {
			metadata: {},
			files: [],
		};
	}

	log(action, ...params) {
		console.log(action.padStart(12) + ':', ...params);
	}

	async add(params) {
		let content = await fs.readFile(params.target);
		this.archive.files.push({
			name: params.name || params.target,
			nativeSize: 0,
			diskSize: content.length,
			type: undefined,
			getRaw: () => content,
		});
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
		if (!targetFile) {
			throw new OperationsError(`extract: archive does not contain "${params.target}"`);
		}
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
		const data = targetFile.getRaw();
		this.log('extracting', params.target, params.name ? 'as ' + params.name : '');
		return fs.writeFile(params.name || params.target, data);
	}

	async identify(params) {
		if (!params.target) {
			throw new OperationsError('identify: missing filename');
		}
		Debug.mute(false);

		console.log('Autodetecting file format...');
		let content = await fs.readFile(params.target);
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

	list(params) {
		let totalDiskSize = 0, totalNativeSize = 0;

		this.archive.files.forEach(file => {
			let size = '';
			if (file.nativeSize != 0) {
				size += humanFileSize(file.nativeSize)/*.padStart(6)*/ + ' -> ';
			} else {
				size += ''.padStart(6) + '    ';
			}
			size += humanFileSize(file.diskSize);//.padStart(6);
			const str =
						size.padStart(16)
						+ ' ' + (file.name || '-').padEnd(32)
						+ (file.type || '-')
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

	async open(params) {
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

		let content = await fs.readFile(params.target);
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
		return fs.writeFile(params.target, outBuffer);
	}

	type(params) {
		if (!params.target) {
			throw new OperationsError('extract: missing filename');
		}

		const targetName = params.target.toUpperCase(); // nearly always ASCII
		const targetFile = this.archive.files.find(file => file.name.toUpperCase() == targetName);
		if (!targetFile) {
			throw new OperationsError(`extract: archive does not contain "${params.target}"`);
		}
		const data = targetFile.getRaw();
		process.stdout.write(data);
	}
};

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
		{ name: 'formats', type: Boolean },
		{ name: 'name', defaultOption: true },
	];
	let argv = process.argv;

	let state = {
		archive: {
			metadata: {},
			files: [],
		},
	};

	let proc = new Operations();

	while (argv.length > 0) {

		const cmd = commandLineArgs(cmdDefinitions, { argv, stopAtFirstUnknown: true });
		argv = cmd._unknown || [];

		if (cmd.formats) {
			listFormats();
			break;
		}

		if (cmd.debug) Debug.mute(false);

		const def = Operations.names[cmd.name];
		if (def) {
			const runOptions = commandLineArgs(def, { argv, stopAtFirstUnknown: true });
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
	}
}

processCommands();
