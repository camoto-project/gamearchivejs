/**
 * @file Base class for fixed-file archives.
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

const { RecordBuffer, RecordType } = require('@malvineous/record-io-buffer');

const Archive = require('../formats/archive.js');

module.exports = class FixedArchive
{
	static parse(content, files) {
		let archive = new Archive();

		let buffer = new RecordBuffer(content);

		let nextOffset = 0, extraFileCount = 1;
		files.forEach(file => {
			if (nextOffset != file.offset) {
				// There's unclaimed data before this file, so add a dummy file for it.
				let ef = new Archive.File();
				ef.name = `data${extraFileCount}.bin`;
				ef.offset = nextOffset;
				ef.diskSize = ef.nativeSize = file.offset - nextOffset;
				ef.getRaw = () => buffer.getU8(ef.offset, ef.diskSize);
				archive.files.push(ef);
				nextOffset = file.offset;
				extraFileCount++;
			}
			let newFile = new Archive.File();
			newFile.name = file.name;
			newFile.offset = file.offset;
			newFile.diskSize = newFile.nativeSize = file.diskSize;
			newFile.getRaw = () => buffer.getU8(newFile.offset, newFile.diskSize);
			archive.files.push(newFile);
			nextOffset = file.offset + file.diskSize;
		});

		if (nextOffset != content.length) {
			// Keep the trailing data too
			let ef = new Archive.File();
			ef.name = `data${extraFileCount}.bin`;
			ef.offset = nextOffset;
			ef.diskSize = ef.nativeSize = content.length - nextOffset;
			ef.getRaw = () => buffer.getU8(ef.offset, ef.diskSize);
			archive.files.push(ef);
		}

		return archive;
	}

	static generate(archive)
	{
		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			0
		);

		let buffer = new RecordBuffer(finalSize);

		archive.files.forEach(file => {
			const diskData = file.getRaw();

			// Safety check.
			if (diskData.length != file.diskSize) {
				throw new Error('Length of data and diskSize field do not match!');
			}

			buffer.put(diskData);
		});

		return {
			main: buffer.getU8(),
		};
	}

};
