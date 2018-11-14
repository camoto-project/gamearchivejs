const fileTypes = [
	// These file formats all have signatures so the autodetection is
	// fast and they are listed first.
	require('./formats/arc-grp-build.js'),
	...require('./formats/arc-rff-blood.js'),

	// These formats require enumeration, sometimes all the way to the
	// end of the file, so they are next.
	require('./formats/arc-dat-fast.js'),

	// These formats are so ambiguous that they are often misidentified,
	// so they are last.
	// Coming soon :)
];

module.exports = class GameArchive
{
	/// Get a handler by ID directly.
	/**
	 * @param string type
	 *   Identifier of desired file format.
	 *
	 * @return Type from formats/*.js matching requested code, or null
	 *   if the code is invalid.
	 */
	static getHandler(type)
	{
		return fileTypes.find(x => type === x.metadata().id);
	}

	/// Get a handler by examining the file content.
	/**
	 * @param Buffer content
	 *   Archive file content.
	 *
	 * @return Array of types from formats/*.js that can handle the
	 *   format, or an empty array if the format could not be identified.
	 */
	static findHandler(content)
	{
		let handlers = [];
		fileTypes.some(x => {
			const metadata = x.metadata();
			const confidence = x.identify(content);
			if (confidence === true) {
				handlers = [x];
				return true; // exit loop early
			}
			if (confidence === undefined) {
				handlers.push(x);
				// keep going to look for a better match
			}
		});
		return handlers;
	}

	/// Get a list of all the available handlers.
	/**
	 * This is probably only useful when testing the library.
	 *
	 * @return Array of file format handlers, with each element being
	 *   just like getHandler() returns.
	 */
	static listHandlers() {
		return fileTypes;
	}
};

module.exports.Archive = require('./formats/archive.js');
