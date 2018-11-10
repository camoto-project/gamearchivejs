module.exports = class ArchiveHandler
{
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
}
