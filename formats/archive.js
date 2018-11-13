module.exports = class Archive {
	constructor() {
		/// Any metadata describing the archive file itself goes here.
		/**
		 * Some archives have a description, comment, or other information that's
		 * not otherwise part of any file inside the archive.
		 */
		this.metadata = {};

		/// All the files in the archive.
		/**
		 * Each element in the array is an Archive.File object.
		 */
		this.files = [];
	};
};

module.exports.File = class File {
	constructor() {
		// Filename.
		this.name = null;

		// File type if known, as "major/minor".  Major is typically the type of
		// editor (map, image, music, etc.) and minor is the file format.  This
		// should only be set if the information is provided by the archive
		// metadata.
		this.type = undefined;

		/// On-disk file size.
		/**
		 * This is the number of bytes the file takes up inside the archive file,
		 * not counting any file-specific header that is not part of the file
		 * content.  If the file is compressed, this is the compressed size.  If the
		 * file is not compresed, this will be the same as nativeSize.
		 */
		this.diskSize = undefined;

		/// Native file size.
		/**
		 * This is the number of bytes in the file's native format, once extracted
		 * from the archive.  If the file is compressed, this is the decompressed
		 * size.  If the file is not compressed, this will be the same as diskSize.
		 */
		this.nativeSize = undefined;

		// Default attributes for this file.
		this.attributes = {
			compressed: false,
			encrypted: false,
		};

		this.getContent = () => this.getRaw();
	}

	/// Read this file.
	/**
	 * By default the content returned is exactly the same as the raw data.
	 * This function should be overridden if processing needs to be performed on
	 * the raw data before it is suitable for use, e.g. by decompressing it.
	 *
	 * @return Buffer containing the file data in its native (decompressed,
	 *   decrypted) format.
	 */
	getContent() {
		return this.getRaw();
	}

	/// Read the file exactly as it is in the archive.
	/**
	 * This function will need to be overridden in every file, otherwise it will
	 * not be possible to extract files from the archive.
	 */
	getRaw() {
		throw new Error('getRaw() has not been supplied for this file!');
	}
};
