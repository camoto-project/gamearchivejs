/*
 * Base class for fixed-file archives.
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

import { RecordBuffer } from '@camoto/record-io-buffer';
import Archive from '../interface/archive.js';
import File from '../interface/file.js';

export default class FixedArchive
{
	static parse(content, files) {
		let archive = new Archive();

		let buffer = new RecordBuffer(content);

		let nextOffset = 0, extraFileCount = 1;
		for (const file of files) {
			if (
				(file.offset !== undefined) // if we were given an offset
				&& (nextOffset != file.offset) // and it's not where we're up to
			) {
				// There's unclaimed data before this file, so add a dummy file for it.
				let ef = new File();
				ef.name = `data${extraFileCount}.bin`;
				ef.offset = nextOffset;
				ef.diskSize = ef.nativeSize = file.offset - nextOffset;
				ef.getRaw = () => buffer.getU8(ef.offset, ef.diskSize);
				ef.getRaw.fixedArchive = true;
				ef.getContent.fixedArchive = true;
				archive.files.push(ef);
				nextOffset = file.offset;
				extraFileCount++;
			}
			let newFile = new File();
			newFile.name = file.name;
			newFile.offset = file.offset || nextOffset;
			newFile.diskSize = file.diskSize;
			newFile.nativeSize = file.nativeSize || file.diskSize;
			newFile.getRaw = () => buffer.getU8(newFile.offset, newFile.diskSize);
			if (file.reveal) {
				newFile.getContent = () => file.reveal(newFile.getRaw());
			}
			newFile.getRaw.fixedArchive = true;
			newFile.getContent.fixedArchive = true;
			newFile.attributes.compressed = file.compressed;
			archive.files.push(newFile);
			nextOffset = newFile.offset + file.diskSize;
		}

		if (nextOffset > content.length) {
			throw new Error(`Final file started at offset ${nextOffset} but this is `
				+ `beyond the end of the archive (${content.length} b).`);
		}
		if (nextOffset != content.length) {
			// Keep the trailing data too
			let ef = new File();
			ef.name = `data${extraFileCount}.bin`;
			ef.offset = nextOffset;
			ef.diskSize = ef.nativeSize = content.length - nextOffset;
			ef.getRaw = () => buffer.getU8(ef.offset, ef.diskSize);
			ef.getRaw.fixedArchive = true;
			ef.getContent.fixedArchive = true;
			archive.files.push(ef);
		}

		// Save the original file list for when we generate() later, so we can look
		// up which files are supposed to be compressed/encrypted.
		archive.fixedArchive = {
			originalFiles: files,
		};

		return archive;
	}

	static generate(archive)
	{
		// Make sure we are processing something previously produced by parse().
		if (!archive.fixedArchive.originalFiles) {
			throw new Error('Cannot build this archive format from scratch, sorry.');
		}

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = archive.files.reduce(
			(a, b) => a + (b.nativeSize || 0),
			0
		);

		let buffer = new RecordBuffer(finalSize);

		for (const file of archive.files) {

			let diskData;
			if (file.getRaw.fixedArchive && file.getContent.fixedArchive) {
				// This file hasn't been modified so leave it as is.
				diskData = file.getRaw();
			} else {
				const orig = archive.fixedArchive.originalFiles.find(f => f.name === file.name);
				if (!orig) {
					throw new Error(`File ${file.name} does not exist inside the archive `
						+ `already, only existing files can be overwritten.`);
				}
				diskData = file.getContent();
				if (orig.obscure) {
					console.log(`Compressing ${diskData.length}`);
					// Have to compress/encrypt this first.
					diskData = orig.obscure(diskData);
				}
				if (diskData.length !== orig.diskSize) {
					throw new Error(`File "${file.name}" is ${diskData.length} bytes, but `
						+ `it must be exactly ${orig.diskSize} bytes.`);
				}
			}

			buffer.put(diskData);
		}

		return buffer.getU8();
	}
}
