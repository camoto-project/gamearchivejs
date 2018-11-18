const lint = require('mocha-eslint');

const paths = [
	'cli',
	'formats',
	'test',
	'util',
];

lint(paths);
