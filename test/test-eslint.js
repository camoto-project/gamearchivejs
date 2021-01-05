import lint from 'mocha-eslint';

const paths = [
	'index.js',
	'cli/*.js',
	'formats',
	'interface',
	'test',
	'util',
];

lint(paths);
