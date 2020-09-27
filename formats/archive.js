/**
 * @file Archive base class and defaults.
 *
 * Copyright (C) 2018-2019 Adam Nielsen <malvineous@shikadi.net>
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
 * Base class describing the interface to an archive.
 *
 * Instances of this class are returned when reading archives, and are passed
 * to the format handlers to produce new archive files.
 *
 * @name Archive
 * @kind class
 */
module.exports = class Archive {
	constructor() {
		/**
		 * Any metadata describing the archive file itself goes here.
		 *
		 * Some archives have a description, comment, or other information that's
		 * not otherwise part of any file inside the archive.
		 */
		this.tags = {};

		/**
		 * An array of all the files in the archive.
		 *
		 * Each element in the array is an Archive.File object.
		 */
		this.files = [];
	}
};

/**
 * Base class describing the interface to a file inside an archive.
 *
 * Instances of this class are returned in the 'file' array in the {Archive}
 * instance.
 *
 * @name File
 * @kind class
 */
module.exports.File = class File {
	constructor() {
		/**
		 * Filename, as it appears in the archive file (case is not changed).
		 *
		 * @type {string}
		 */
		this.name = null;

		/**
		 * File type if known, as "major/minor".
		 *
		 * @type {string}
		 *
		 * Major is typically the type of editor (map, image, music, etc.) and
		 * minor is the file format.  This should only be set if the information is
		 * provided by the archive metadata.
		 */
		this.type = undefined;

		/**
		 * Date the file was last modified.
		 *
		 * @type {Date}
		 *
		 * This is only set if it is supported by the archive format.  It is either
		 * undefined or a Date object in local time.
		 */
		this.lastModified = undefined;

		/**
		 * On-disk file size.
		 *
		 * @type {Number}
		 *
		 * This is the number of bytes the file takes up inside the archive file,
		 * not counting any file-specific header that is not part of the file
		 * content.  If the file is compressed, this is the compressed size.  If the
		 * file is not compresed, this will be the same as nativeSize.
		 *
		 * This field is for information only after parsing an archive and is
		 * unused when creating a new archive.  If the compressed size is needed
		 * when creating an archive, the entire buffer returned by getContent() is
		 * automatically compressed and the size gleaned from that.
		 *
		 * After creating an archive with generate(), this field may be populated to
		 * reflect the newly written format.
		 */
		this.diskSize = undefined;

		/**
		 * Native file size.
		 *
		 * @type {Number}
		 *
		 * This is the number of bytes in the file's native format, once extracted
		 * from the archive.  If the file is compressed, this is the decompressed
		 * size.  If the file is not compressed, this will be the same as diskSize.
		 *
		 * This field is for information only after parsing an archive and is
		 * not required when creating a new archive, however supplying it will allow
		 * the format handler to preallocate enough memory up front for the whole
		 * archive, improving performance.  So this value should be supplied if it
		 * can be done so efficiently.  Either way, the actual file size used when
		 * creating archives is the length of the buffer returned by getContent().
		 *
		 * After creating an archive with generate(), this field may be populated to
		 * reflect the newly written format.
		 */
		this.nativeSize = undefined;

		/**
		 * Attributes for this specific file.
		 *
		 * @type {FileAttributes}
		 *
		 * Default attributes for this file are undefined, which means "don't care"
		 * when writing the archive, and "unsupported attribute" when reading an
		 * archive.
		 */
		this.attributes = {
			compressed: undefined,
			encrypted: undefined,
		};

		this.getContent = () => this.getRaw();
	}

	/**
	 * Read this file.
	 *
	 * By default the content returned is exactly the same as the raw data.
	 * This function should be overridden if processing needs to be performed on
	 * the raw data before it is suitable for use, e.g. by decompressing it.
	 *
	 * @return {Buffer} containing the file data in its native (decompressed,
	 *   decrypted) format.
	 */
	getContent() {
		return this.getRaw();
	}

	/**
	 * Read the file exactly as it is in the archive.
	 *
	 * This function will need to be overridden in every file, otherwise it will
	 * not be possible to extract files from the archive.
	 *
	 * @return {Buffer} containing the file data in its on-disk (compressed,
	 *   encrypted) format.
	 */
	getRaw() {
		throw new Error('getRaw() has not been supplied for this file!');
	}
};
