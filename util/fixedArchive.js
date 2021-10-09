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

import Debug from '../util/debug.js';
const debug = Debug.extend('fixedArchive');

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
				if (ef.diskSize < 0) {
					throw new Error(`FixedArchive files are out of order, they must be `
						+ `supplied in order with the lowest offset first.  Offending `
						+ `file: ${file.name}`);
				}
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
				newFile.getContent = () => file.reveal(newFile.getRaw(), file);
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

		return archive;
	}

	static generate(archive, expectedFiles)
	{
		if (!expectedFiles) {
			throw new Error('Second parameter is mandatory for FixedArchive.generate()');
		}

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const finalSize = expectedFiles.reduce(
			(a, b) => a + (b.nativeSize || 0),
			0
		);

		let buffer = new RecordBuffer(finalSize);

		let nextOffset = 0, extraFileCount = 1, expectedDiskSize;
		let nextFilename = '';
		let allowedFiles = [];
		for (let i = 0; i < expectedFiles.length; i++) {
			const file = expectedFiles[i];

			if (
				(file.offset !== undefined) // if we were given an offset
				&& (nextOffset != file.offset) // and it's not where we're up to
			) {
				// There's unclaimed data before this file, so add a dummy file for it.
				nextFilename = `data${extraFileCount}.bin`;
				expectedDiskSize = file.offset - nextOffset;
				extraFileCount++;
				i--; // process this file again once we've added the 'dataX.bin' file
			} else {
				nextFilename = file.name.toLowerCase();
				expectedDiskSize = file.diskSize;
			}
			allowedFiles.push(nextFilename);

			const targetFile = archive.files.find(f => f.name.toLowerCase() === nextFilename);
			if (!targetFile) {
				throw new Error(`File ${nextFilename} must exist in this archive format.`);
			}

			let diskData;
			if (targetFile.getRaw.fixedArchive && targetFile.getContent.fixedArchive) {
				// This file hasn't been modified so leave it as is.
				diskData = targetFile.getRaw();
			} else {
				diskData = targetFile.getContent();
				if (file.obscure) {
					// Have to compress/encrypt this first.
					diskData = file.obscure(diskData, file);
				}
			}
			if (diskData.length !== expectedDiskSize) {
				throw new Error(`File "${nextFilename}" is ${diskData.length} bytes, `
					+ `but it must be exactly ${expectedDiskSize} bytes.`);
			}

			buffer.put(diskData);
			nextOffset += diskData.length;
		}

		// Add a final file for any trailing data, although we don't know the full
		// expected output file size.
		nextFilename = `data${extraFileCount}.bin`;
		extraFileCount++;
		allowedFiles.push(nextFilename);
		const targetFile = archive.files.find(f => f.name.toLowerCase() === nextFilename);
		if (targetFile) {
			// This final file is present, so include it.
			let diskData;
			if (targetFile.getRaw.fixedArchive && targetFile.getContent.fixedArchive) {
				// This file hasn't been modified so leave it as is.
				diskData = targetFile.getRaw();
			} else {
				diskData = targetFile.getContent();
			}
			buffer.put(diskData);
		}

		// Make sure there are no extra files.
		for (const file of archive.files) {
			const orig = allowedFiles.includes(file.name.toLowerCase());
			if (!orig) {
				throw new Error(`File ${file.name} does not exist inside the archive `
					+ `already, only existing files can be overwritten.`);
			}
		}

		return buffer.getU8();
	}
}
