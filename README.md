# gamearchive.js
Copyright 2018 Adam Nielsen <<malvineous@shikadi.net>>  

This is a Javascript library that can read and write archive files
used by a number of MS-DOS games from the 1990s.  Archive files are
like `.zip` files, except many games used their own custom file
formats.  This library is an attempt to provide a unified interface
for reading and writing many of these formats.

## Installation as an end-user

If you wish to use the command-line `gamearch` utility to work with
game archives directly, you can install the library globally on your
system:

    npm install -g @malvineous/gamearch

### Command line interface

The `gamearch` utility can be used to manipulate archive files.
Commands are specified one after the other as parameters.  Use the
`--help` option to get a list of all the available commands.  Some
quick examples:

    # Copy a file out of an existing archive
    gamearch open duke3d.grp extract stalker.mid
    
    # Create a new archive
    gamearch add stalker.mid save -f arc-grp-build music.grp
    
    # Convert an archive into another format
    gamearch open duke3d.grp save -f arc-rff-blood-v301 duke3d.rff

To get a list of supported file formats, run:

    gamearch --formats

## Installation as a dependency

If you wish to make use of the library in your own project, install it
in the usual way:

    npm install @malvineous/gamearch

See `cli/index.js` for example use.  The quick start is:

    const GameArchive = require('@malvineous/gamearch');
    
    // Read an archive into memory
    const handler = GameArchive.getHandler('arc-grp-duke3d');
    const content = fs.readFileSync('duke3d.grp');
    let archive = handler.parse(content);
    
    // List the files in the archive
    archive.files.forEach(file => {
        console.log(file.name);
    });
    
    // Extract a file
    const data = archive.files[0].getRaw();
    fs.writeFileSync(archive.files[0].name, data);

    // Rename a file
    archive.files[0].name = 'RENAMED.BIN';
    
    // Remove a file
    delete archive.files[1];
    
    // Write the archive back to disk with the modifications
    const outBuffer = handler.generate(archive);
    fs.writeFileSync('new.grp', outBuffer);

## Installation as a contributor

If you would like to help add more file formats to the library, great!
Clone the repo, and to get started:

    npm install --dev

Run the tests to make sure everything worked:

    npm test

You're ready to go!  To add a new file format:

 1. Create a new file in the `formats/` folder for your format.
    Copying an existing file that covers a similar format will help
    considerably.  If you're not sure, `arc-grp-build.js` is a good
    starting point as it is fairly simple.
    
 2. Edit the main `index.js` and add a `require()` statement for your new file.
    
 3. Make a folder in `test/` for your new format and populate it with
    files similar to the other formats.  The tests work by creating
    a standard archive file with some preset files in it, and
    comparing the result to what is inside this folder.
    
    You can either create these archives by hand, with another utility, or if
    you are confident that your code is correct, from the code itself.  This is
    done by setting an environment variable when running the tests, which will
    cause the archive file produced by your code to be saved to a temporary
    file in the current directory:
    
        SAVE_FAILED_TEST=1 npm test
        mv error1.bin test/arc-myformat/default.bin

If your archive format has any sort of compression or encryption,
these algorithms should go into the `gamecomp` project instead.  This
is to make it easier to reuse the algorithms, as many of them
(particularly the compression ones) are used amongst many unrelated
archive formats.  All the `gamecomp` algorithms are available to be
used by any archive format in this library.

During development you can test your algorithm like this:

    # Read a sample archive and list the files, with debug messages on
    $ ./bin/gamearch --debug open -f arc-myformat example.dat list

    # Make sure the format is identified correctly or if not why not
    $ ./bin/gamearch --debug identify example.dat

If you use `Debug.log` rather than `console.log` then these messages can be left
in for future diagnosis as they will only appear when `--debug` is given.
