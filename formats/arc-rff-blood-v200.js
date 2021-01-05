/*
 * Blood .RFF format handler, version 2.0.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/RFF_Format
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

import Archive_RFF_Blood_Common from './arc-rff-blood-common.js';

export default class Archive_RFF_Blood_v200 extends Archive_RFF_Blood_Common
{
	static version() {
		return 0x200;
	}

	static getCrypto() {
		return null;
	}

	static getKeyOffset_File() {
		return 0;
	}

	static getKeyOffset_FAT() {
		return 0;
	}
}
