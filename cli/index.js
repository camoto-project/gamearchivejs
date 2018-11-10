const fs = require('fs').promises;
const commandLineArgs = require('command-line-args');
const GameArchive = require('../index.js');

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
		this.log('deleting', params.target);
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
		await fs.writeFile(params.name || params.target, data);
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
						+ ' ' + file.name.padEnd(32)
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

		let content = await fs.readFile(params.target);
		if (!handler) {
			handler = GameArchive.findHandler(content);
		}
		if (!handler) {
			throw new OperationsError('Unable to identify this archive format.');
			return;
		}

		this.archive = handler.parse(content);
		this.origFormat = handler.metadata().id;
	}

	async save(params) {
		if (!params.target) {
			throw new OperationsError('save: missing filename');
		}
		if (!params.format) params.format = this.origFormat;

		let handler = GameArchive.getHandler(params.format);
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
		} else {
			const outBuffer = handler.generate(this.archive);
			await fs.writeFile(params.target, outBuffer.getBuffer());
		}

		console.log('Saving to', params.target, 'as', params.format);
		const outBuffer = handler.generate(this.archive);
		await fs.writeFile(params.format, outBuffer);
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
	list: [],
	open: [
		{ name: 'format', alias: 'f' },
		{ name: 'target', defaultOption: true },
	],
	save: [
		{ name: 'format', alias: 'f' },
		{ name: 'target', defaultOption: true },
	],
};


async function processCommands()
{
	let cmdDefinitions = [
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

		const def = Operations.names[cmd.name];
		if (def) {
			const runOptions = commandLineArgs(def, { argv, stopAtFirstUnknown: true });
			argv = runOptions._unknown || [];
			try {
				await proc[cmd.name](runOptions);
			} catch (e) {
				if (e instanceof OperationsError) {
					console.log(e.message);
					process.exit(2);
				}
				throw e;
			}
		} else {
			console.log(`Unknown command: ${cmd.name}`);
			process.exit(1);
		}
	}
}

//run();
processCommands();
