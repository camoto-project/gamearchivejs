/*
 * Supplementary file support, for formats spread across multiple files.
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
 * Replace the base filename without affecting the path or extension.
 *
 * "/folder/file.ext" -> "/folder/new.ext"
 */
export function replaceBasename(name, newBase)
{
	const origExt = getExtension(name);
	const newSuffix = origExt.length && ('.' + origExt) || '';
	return replaceFilename(name, newBase + newSuffix);
}

/**
 * Replace the filename extension without affecting the path or base name.
 *
 * "/folder/file.ext" -> "/folder/file.new"
 */
export function replaceExtension(name, newExt)
{
	return name.replace(/\.[^/.]+$/, '') + '.' + newExt;
}

/**
 * Replace the filename without affecting the path.
 *
 * "/folder/file.ext" -> "/folder/newfile.new"
 */
export function replaceFilename(name, newName)
{
	return name.replace(/(\/)?[^/]+$/, '$1') + newName;
}

/**
 * Remove any path from the front of the filename.
 *
 * "/folder/file.ext" -> "file.ext"
 */
export function getFilename(name)
{
	const m = name.match(/(\/)?([^/]+)$/);
	return (m && m[2]) || '';
}

/**
 * Extract the basename from the filename.
 *
 * "/folder/file.ext" -> "file"
 */
export function getBasename(name)
{
	const f = getFilename(name);
	const dot = f.lastIndexOf('.');
	if (dot < 0) {
		return f;
	}
	return f.slice(0, dot);
}

/**
 * Extract the extension from the filename.
 *
 * "/folder/file.ext" -> "ext"
 */
export function getExtension(name)
{
	const m = name.match(/\.([^.]+)$/);
	return (m && m[1]) || '';
}
