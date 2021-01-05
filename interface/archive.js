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
	}
}
