/*
 * Base class and defaults for archive format handlers.
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
const debug = Debug.extend('archiveHandler');

/**
 * Base class and defaults for archive format handlers.
 *
 * To implement a new archive file format, this is the class that will be
 * extended and its methods replaced with ones that perform the work.
 */
export default class ArchiveHandler
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
			 *   often in this format.  An example is
			 *   `['*.txt', '*.doc', 'file*.bin']`.
			 *
			 * @property {Object} caps
			 *   Capability flags indicating what the format can or cannot support.
			 *
			 * @property {Number} caps.maxFileCount
			 *   Maximum number of files that can be stored in the archive file, or
			 *   `undefined` if there is no maximum limit.
			 *
			 * @property {Object} caps.file
			 *   Capabilities relating to files inside the archive.
			 *
			 * @property {Boolean} caps.file.lastModified
			 *   `true` if files can have their last-modified date stored.  Default
			 *   is `false`.
			 *
			 * @property {Object} caps.file.attributes
			 *   Capabilities relating to attributes that can be set on files. If
			 *   the values here are set to `true` or `false` then that attribute is
			 *   allowed to be set on a per-file basis for files in this archive.
			 *   If the value here is `undefined`, then that attribute is fixed by
			 *   the archive format (either forced on or off) and any value set on
			 *   individual files will be ignored.
			 *
			 * @property {Boolean} caps.file.attributes.compressed
			 *   `true` if the file is compressed when stored in the archive, `false`
			 *   if not.  Will be `undefined` when reading an archive if the
			 *   attribute is unsupported, and it can be set to `undefined` when
			 *   writing an archive to use the default value for the format.
			 *
			 * @property {Boolean} caps.file.attributes.encrypted
			 *   `true` if the file is encrypted when stored in the archive, `false`
			 *   if not.  Will be `undefined` when reading an archive if the
			 *   attribute is unsupported, and it can be set to `undefined` when
			 *   writing an archive to use the default value for the format.
			 *
			 * @property {Number} caps.file.maxFilenameLen
			 *   Number of characters in the filename, including dots.  If the
			 *   archive can only store normal DOS 8.3 filenames, then this would
			 *   be `12`.  If the format does not contain filenames, set this to `0`.
			 *   If set to `undefined` there is no restriction on filename length.
			 *
			 * @property {Object} caps.tags
			 *   Key=Value list of tags this format supports, e.g.
			 *   `{ desc: 'Description' }`.
			 */
			id: 'unknown',
			title: 'Unknown format',
			games: [],
			glob: [],
			caps: {
				maxFileCount: undefined,
				file: {
					lastModified: false,
					attributes: {
						compressed: undefined,
						encrypted: undefined,
					},
					maxFilenameLen: undefined,
				},
				tags: {},
			},
		};
	}

	/**
	 * Identify any problems writing the given archive in the current format.
	 *
	 * @param {Archive} archive
	 *   Archive to attempt to write in this handler's format.
	 *
	 * @return {Array<string>} listing any problems that will prevent the
	 *   supplied archive from being written in this format.  An empty array
	 *   indicates no problems.
	 */
	static checkLimits(archive)
	{
		const { caps } = this.metadata();
		let issues = [];

		if (caps.maxFileCount && (archive.files.length > caps.maxFileCount)) {
			issues.push(`There are ${archive.files.length} files to save, but this `
				+ `archive format can only store up to ${caps.maxFileCount} files.`);
		}

		for (let i = 0; i < archive.files.length; i++) {
			const file = archive.files[i];

			if (caps.file.maxFilenameLen === 0) {
				if (file.name) {
					issues.push(`File @${i} has filename "${file.name}" but this format does not support filenames.`);
				}
			} else if (caps.file.maxFilenameLen !== undefined) { // no limit
				if (file.name.length > caps.file.maxFilenameLen) {
					issues.push(`Filename length is ${file.name.length}, max is `
						+ `${caps.file.maxFilenameLen}: ${file.name}`);
				}
			}

			/* Disable this check as it will cause the data to be decompressed and
				 then discarded, making saving slow.
			if (file.nativeSize === 0) {
				const content = file.getContent();
				if (content.length !== 0) {
					Debug.warn(`File ${file.name} has nativeSize unset but content is ` +
						`${content.length} bytes.  This will cause slow memory ` +
						`reallocations during archive writes and should be fixed if ` +
						`possible.`
					);
				}
			}
			*/
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
	 * This function also serves another purpose, in providing a canonical
	 * filename for the main archive file even if there are no supplementary
	 * files.  This is used when converting from one archive format to another,
	 * which in most cases will take the supplied filename and change the
	 * extension to match that for this file format.
	 *
	 * @param {string} filename
	 *   Archive filename.
	 *
	 * @param {Uint8Array} content
	 *   Archive content.
	 *
	 * @return `Object<id, string>` where the key is an ID specific to this format
	 *   handler, and the value is the case-insensitive filename.  There must
	 *   always be a `main` key for the main archive filename.  Don't convert
	 *   passed names to uppercase or lowercase, but any changes (e.g. appending
	 *   a filename extension) should be lowercase.
	 */
	// eslint-disable-next-line no-unused-vars
	static supps(filename, content) {
		throw new Error('Not implemented yet.');
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
	 * @param {Uint8Array} content
	 *   The archive to examine.
	 *
	 * @param {string} filename
	 *   The archive's filename in case it is relevant, for those formats where
	 *   the filename extension is significant.
	 *
	 * @return {object} with a `.valid` property, set to `true` if the data is
	 *   definitely in this format, `false` if it is definitely not in this
	 *   format, and `undefined` if it's possible the data is in this format but
	 *   there is not enough information to know for certain one way or the other.
	 *   The returned object also has a `.reason` property containing a technical
	 *   although user-friendly explanation as to why the data was decreed to be
	 *   or not be in this format.  This is most useful when uncertain or
	 *   rejecting content, as the user can then be informed why.
	 */
	// eslint-disable-next-line no-unused-vars
	static identify(content, filename) {
		return {
			valid: false,
			reason: 'The identify() function has not been implemented by the format '
				+ 'handler, so autodetecting this format is not possible.',
		};
	}

	/**
	 * Read the given archive file.
	 *
	 * @param {Object} content
	 *   File content of the archive.  The `main` property contains the main
	 *   file, with any other supps as other properties.  Each property is a
	 *   {Uint8Array}.
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
	 * Preconditions: The parameter has already been passed through
	 *   {@link ArchiveHandler.checkLimits checkLimits()} successfully.  If not,
	 *   the behaviour is undefined and a corrupted file might be produced.
	 *
	 * @param {Archive} archive
	 *   The contents of the file to write.
	 *
	 * @return {Object} containing the contents of the file in the `main`
	 *   property, with any other supp files as other properties.  Each property
	 *   is a `Uint8Array` suitable for writing directly to a file on disk or
	 *   offering for download to the user.
	 */
	// eslint-disable-next-line no-unused-vars
	static generate(archive) {
		throw new Error('Not implemented yet.');
	}
}
