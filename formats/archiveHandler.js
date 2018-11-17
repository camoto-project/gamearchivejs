module.exports = class ArchiveHandler
{
	/// Retrieve information about the archive file format.
	/**
	 * This must be overridden by all format handlers.  It returns a structure
	 * detailed below.
	 */
	static metadata() {
		return {
			/// A unique identifier for the format.
			id: 'unknown',

			/// The user-friendly title for the format.
			title: 'Unknown format',

			/// List of games that use this format.
			games: [],

			/// A list of filename globs that match files in this format, if any.
			/**
			 * Examples might be ['*.txt', '*.doc', 'file*.bin'].
			 */
			glob: [],

			/// Capabilities of the archive format.
			caps: {
				// Attributes that apply to files within the archive.
				file: {
					// True if files can have their last-modified date stored.
					lastModified: false,

					// By default none of these attributes can be set for files.
					attributes: {
						compressed: false,
						encrypted: false,
					},
				},
			},

			/// Any limitations of the archive format.
			limits: {
				/// Number of characters in the filename, including dots.
				/**
				 * If the archive can only store normal DOS 8.3 filenames, then this
				 * would be 12.  If omitted there is no restriction on filename length.
				 */
				maxFilenameLen: undefined,
			},
		};
	}

	/// Identify any problems writing the given archive in the current format.
	/**
	 * @param Object archive
	 *   Archive to attempt to write in this handler's format.
	 *
	 * @return Array of strings listing any problems that will prevent the
	 *   supplied archive from being written in this format.  An empty array
	 *   indicates no problems.
	 */
	static checkLimits(archive)
	{
		const { limits } = this.metadata();
		let issues = [];
		if (limits.maxFilenameLen) {
			archive.files.forEach(file => {
				if (file.name.length > limits.maxFilenameLen) {
					issues.push(`Filename length is ${file.name.length}, max is ${limits.maxFilenameLen}: ${file.name}`);
				}
			});
		}
		return issues;
	}

	/// See if the given archive is in the format supported by this handler.
	/**
	 * This is used for format autodetection.
	 *
	 * @note More than one handler might report that it supports a file format,
	 *   such as the case of an empty file, which is a valid empty archive in a
	 *   number of different file formats.
	 *
	 * @param Buffer content
	 *   The archive to examine.
	 *
	 * @return true if the data is definitely in this format, false if it is
	 *   definitely not in this format, and undefined if the data could not be
	 *   positively identified but it's possible it is in this format.
	 */
	static identify(content) {
		return false;
	};

	/// Read the given archive file.
	/**
	 * @param Buffer content
	 *   File content of the archive.
	 *
	 * @return Archive object detailing the contents of the archive file.
	 */
	static parse(content) {
		throw new Error('Not implemented yet.');
	};

	/// Write out an archive file in this format.
	/**
	 * @preconditions The archive has already been passed through checkLimits()
	 *   successfully. If not, the behaviour is undefined and a corrupted file
	 *   might be produced.
	 *
	 * @param Archive archive
	 *   The contents of the file to write.
	 *
	 * @return Buffer instance containing the contents of the file, suitable for
	 *   writing directly to a file on disk or offering for download to the user.
	 */
	static generate(archive) {
		throw new Error('Not implemented yet.');
	};
};
