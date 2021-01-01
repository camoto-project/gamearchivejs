/**
 * @file Supplementary file functions.
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

const Path = require('path');

/**
 * Place to group together helper functions for supplemental data files.
 *
 * @name Supp
 * @kind class
 */
module.exports = class Supp {
	static replaceBasename(name, newBase) {
		return Path.format({
			...Path.parse(name),
			name: newBase,
			base: undefined,
		});
	}

	static replaceExtension(name, newExt) {
		return name.replace(/\.[^/.]+$/, '') + '.' + newExt;
	}
};
