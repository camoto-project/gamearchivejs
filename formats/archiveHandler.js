/**
 * @file Base class and defaults for archive format handlers.
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

/**
 * Base class and defaults for archive format handlers.
 *
 * To implement a new archive file format, this is the class that will be
 * extended and its methods replaced with ones that perform the work.
 *
 * @name ArchiveHandler
 */
module.exports = class ArchiveHandler
{
	/**
	 * Retrieve information about the archive file format.
	 *
	 * This must be overridden by all format handlers.  It returns a structure
	 * detailed below.
	 *
	 * @return {Metadata} object.
	 */
	static metadata() {
		return {
			/**
			 * @typedef {Object} Metadata
			 *
			 * @property {string} id
			 *   A unique identifier for the format.
			 *
			 * @property {string} title
			 *   The user-friendly title for the format.
			 *
			 * @property {Array} games
			 *   A list of strings naming the games that use this format.
			 *
			 * @property {Array} glob
			 *   A list of strings with filename expressions matching files that are
			 *   often in this format.  An examples is ['*.txt', '*.doc', 'file*.bin'].
			 *
			 * @property {ArchiveCaps} caps
			 *   Capability flags indicating what the format can or cannot support.
			 *
			 * @property {ArchiveLimits} limits
			 *   Values indicating what limitations apply to this format.
			 */
			id: 'unknown',
			title: 'Unknown format',
			games: [],
			glob: [],
			caps: {
				/**
				 * @typedef {Object} ArchiveCaps
				 *
				 * @property {Object} file
				 *   Capabilities relating to files inside the archive.
				 *
				 * @property {Boolean} file.lastModified
				 *   True if files can have their last-modified date stored.  Default
				 *   is false.
				 *
				 * @property {FileAttributes} file.attributes
				 *   Capabilities relating to attributes that can be set on files. If
				 *   the values here are set to true then that attribute is allowed to
				 *   be set on a per-file basis for files in this archive.  If the value
				 *   here is false, then that attribute is fixed by the archive format
				 *   (either forced on or off) and cannot be set on individual files.
				 */
				file: {
					lastModified: false,
					/**
					 * @typedef {Object} FileAttributes
					 *
					 * @property {Boolean} compressed
					 *   True if the file is compressed when stored in the archive, false
					 *   if not.  Will be undefined when reading an archive if the
					 *   attribute is unsupported, and it can be set to undefined when
					 *   writing an archive to use the default value for the format.
					 *
					 * @property {Boolean} encrypted
					 *   True if the file is encrypted when stored in the archive, false
					 *   if not.  Will be undefined when reading an archive if the
					 *   attribute is unsupported, and it can be set to undefined when
					 *   writing an archive to use the default value for the format.
					 */
					attributes: {
						compressed: false,
						encrypted: false,
					},
				},
			},
			limits: {
				/**
				 * @typedef {Object} ArchiveLimits
				 *
				 * @property {Number} maxFilenameLen
				 *   Number of characters in the filename, including dots.  If the
				 *   archive can only store normal DOS 8.3 filenames, then this would
				 *   be 12.  If omitted there is no restriction on filename length.
				 */
				maxFilenameLen: undefined,
			},
		};
	}

	/**
	 * Identify any problems writing the given archive in the current format.
	 *
	 * @param {Archive} archive
	 *   Archive to attempt to write in this handler's format.
	 *
	 * @return {Array} of strings listing any problems that will prevent the
	 *   supplied archive from being written in this format.  An empty array
	 *   indicates no problems.
	 */
	static checkLimits(archive)
	{
		const { limits } = this.metadata();
		let issues = [];
		if (limits.maxFilenameLen) {
			archive.files.forEach(file => {
				if (file.name.length > limits.maxFilenameLen) {
					issues.push(`Filename length is ${file.name.length}, max is ${limits.maxFilenameLen}: ${file.name}`);
				}
			});
		}
		return issues;
	}

	/**
	 * Get a list of supplementary files needed to use the format.
	 *
	 * Some formats store their data across multiple files, and this function
	 * will return a list of filenames needed, based on the filename and data in
	 * the main archive file.
	 *
	 * This allows both the filename and archive content to be examined, in case
	 * either of these are needed to construct the name of the supplementary
	 * files.
	 *
	 * @param {string} name
	 *   Archive filename.
	 *
	 * @param {Uint8Array} content
	 *   Archive content.
	 *
	 * @return {Object} where each key is an identifier specific to the handler,
	 *   and the value is the expected case-insensitive filename.  Don't convert
	 *   passed names to lowercase, but any changes (e.g. appending a filename
	 *   extension) should be lowercase.
	 */
	// eslint-disable-next-line no-unused-vars
	static supps(name, content) {
		return {};
	}

	/**
	 * See if the given archive is in the format supported by this handler.
	 *
	 * This is used for format autodetection.
	 *
	 * @note More than one handler might report that it supports a file format,
	 *   such as the case of an empty file, which is a valid empty archive in a
	 *   number of different file formats.
	 *
	 * @param {Buffer} content
	 *   The archive to examine.
	 *
	 * @return {Boolean} true if the data is definitely in this format, false if
	 *   it is definitely not in this format, and undefined if the data could not
	 *   be positively identified but it's possible it is in this format.
	 */
	// eslint-disable-next-line no-unused-vars
	static identify(content) {
		return false;
	}

	/**
	 * Read the given archive file.
	 *
	 * @param {Buffer} content
	 *   File content of the archive.
	 *
	 * @return {Archive} object detailing the contents of the archive file.
	 */
	// eslint-disable-next-line no-unused-vars
	static parse(content) {
		throw new Error('Not implemented yet.');
	}

	/**
	 * Write out an archive file in this format.
	 *
	 * @preconditions The archive has already been passed through checkLimits()
	 *   successfully. If not, the behaviour is undefined and a corrupted file
	 *   might be produced.
	 *
	 * @param {Archive} archive
	 *   The contents of the file to write.
	 *
	 * @return {Buffer} instance containing the contents of the file, suitable for
	 *   writing directly to a file on disk or offering for download to the user.
	 */
	// eslint-disable-next-line no-unused-vars
	static generate(archive) {
		throw new Error('Not implemented yet.');
	}
};
