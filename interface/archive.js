/*
 * Archive base class and defaults.
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

import { getLUID } from '../util/uuid.js';

/**
 * Base class describing the interface to an archive.
 *
 * Instances of this class are returned when reading archives, and are passed
 * to the format handlers to produce new archive files.
 */
export default class Archive
{
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

		// Internal unique ID.
		this.luid = getLUID();
	}

	/**
	 * Add a file to the archive and mark it as unmodified.
	 *
	 * This allows `isFileModified()` to later check whether the file has been
	 * changed.  It allows for certain optimisations, such as avoiding a
	 * decompression/recompression cycle for files that have not been modified.
	 */
	setOriginalFile(file) {
		// Mark this file's content as unique to this archive.  The idea is that
		// if getContent() is changed, or a new File instance is used, the LUID
		// won't match the archive and we'll know it's no longer original content.
		file.getContent.luid = this.luid;

		// Also save the compressed state so we can tell if the compression
		// atttribute was changed without actually modifying the data.
		file._original = {
			attributes: file.attributes,
		};
	}

	/**
	 * Find out whether the file has been changed.
	 *
	 * This examines the flags set by `setOriginalFile()` and returns true if the
	 * file is different to what was originally found in the archive.
	 */
	isFileModified(file) {
		return (
			(this.luid === undefined)
			|| (file.getContent.luid !== this.luid)
			|| (!file._original)
			|| (!file._original.attributes)
			|| (file._original.attributes.compressed !== file.attributes.compressed)
			|| (file._original.attributes.encrypted !== file.attributes.encrypted)
		);
	}
}
