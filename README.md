# gamearchive.js
Copyright 2010-2021 Adam Nielsen <<malvineous@shikadi.net>>  

This is a Javascript library that can read and write archive files used by a
number of MS-DOS games from the 1990s.  Archive files are like `.zip` files,
except many games used their own custom file formats.  This library is an
attempt to provide a unified interface for reading and writing many of these
formats.

## Supported file formats

| Game                      | Files     | Format                    | Code                |
|---------------------------|-----------|---------------------------|---------------------|
| Blood                     | *.rff     | Monolith Resource File Format v2.0/3.0/3.1 | arc-rff-blood-* |
| Commander Keen 4-6        | *.exe     | Keen 4/5/6 .exe           | arc-fixed-keen[456]_exe |
| Cosmo's Cosmic Adventures | *.vol, *.stn | Cosmo Data Volume      | arc-vol-cosmo       |
| Dangerous Dave            | dave.exe  | Dangerous Dave .exe       | arc-fixed-ddave_exe |
| Death Rally               | *.bpa     | Death Rally BPA File      | arc-bpa-drally      |
| Descent                   | *.hog     | Descent HOG File          | arc-hog-descent     |
| Doom                      | *.wad     | Where's All the Data File | arc-wad-doom        |
| Duke Nukem 3D             | *.grp     | BUILD Group File          | arc-grp-build       |
| Duke Nukem II             | *.cmp     | Cosmo Data Volume         | arc-vol-cosmo       |
| Grand Prix Legends        | *.dat     | Papyrus Data File (V2)    | arc-dat-papyrus-v2  |
| Halloween Harry           | *.bnk     | SubZero Data Bank         | arc-bnk-harry       |
| IndyCar Racing            | *.dat     | Papyrus Data File (V2)    | arc-dat-papyrus-v2  |
| IndyCar Racing II         | *.dat     | Papyrus Data File (V2)    | arc-dat-papyrus-v2  |
| J.R.R. Tolkien's Riders of Rohan | *.dat | Papyrus Data File (V1) | arc-dat-papyrus-v1  |
| Lion King, The            | *.dat     | East Point File Storage   | arc-epf-eastpoint   |
| Major Stryker             | *.ms[123] | Cosmo Data Volume         | arc-vol-cosmo       |
| Monster Bash              | *.dat     | F.A.S.T. Data File        | arc-dat-fast        |
| NASCAR Racing             | *.dat     | Papyrus Data File (V2)    | arc-dat-papyrus-v2  |
| NASCAR Racing 2           | *.dat     | Papyrus Data File (V2)    | arc-dat-papyrus-v2  |
| NASCAR Racing 3           | *.dat     | Papyrus Data File (V2)    | arc-dat-papyrus-v2  |
| Nomad                     | *.dat     | Papyrus Data File (V1)    | arc-dat-papyrus-v1  |
| Raptor                    | *.glb     | Raptor Game Library       | arc-glb-raptor      |
| Redneck Rampage           | *.grp     | BUILD Group File          | arc-grp-build       |
| Scubaventure              | *.dat     | F.A.S.T. Data File        | arc-dat-fast        |
| Shadow Warrior            | *.grp     | BUILD Group File          | arc-grp-build       |
| Terminal Velocity         | *.pod     | Terminal Reality POD File | arc-pod-tv          |
| Vinyl Goddess From Mars   | *.lbr     | Vinyl Library File        | arc-lbr-vinyl       |
| Wacky Wheels              | *.dat     | Wacky Wheels Data File    | arc-dat-wacky       |

## Installation as an end-user

If you wish to use the command-line `gamearch` utility to work with game
archives directly, you can install the CLI globally on your system:

    npm install -g @camoto/gamearchive-cli

For Arch Linux users the AUR package `gamearchive-cli` is also available.

### Command line interface

The `gamearch` utility can be used to manipulate archive files.
Commands are specified one after the other as parameters.  Use the
`--help` option to get a list of all the available commands.  Some
quick examples:

    # Copy a file out of an existing archive
    gamearch open duke3d.grp extract stalker.mid
    
    # Create a new archive
    gamearch add stalker.mid save -t arc-grp-build music.grp
    
    # Convert an archive into another format
    gamearch open duke3d.grp save -t arc-rff-blood-v301 duke3d.rff

To get a list of supported file formats, run:

    gamearch --formats

## Installation as a dependency

If you wish to make use of the library in your own project, install it
in the usual way:

    npm install @camoto/gamearchive

See `cli/index.js` for example use.  The quick start is:

    import { arc_grp_build } from '@camoto/gamearchive';
    
    // Read an archive into memory
    const content = {
        main: fs.readFileSync('duke3d.grp'),
        // Some formats need additional files here, see handler.supps()
    };
    let archive = arc_grp_build.parse(content);
    
    // List the files in the archive
    for (const file of archive.files) {
        console.log(file.name);
    }
    
    // Extract a file, decompressing it if necessary.
    const data = archive.files[0].getContent();
    fs.writeFileSync(archive.files[0].name, data);

    // Rename a file
    archive.files[0].name = 'RENAMED.BIN';
    
    // Remove a file
    delete archive.files[1];
    
    // Write the archive back to disk with the modifications
    const outBuffer = arc_grp_build.generate(archive);
    fs.writeFileSync('new.grp', outBuffer.main);

## Installation as a contributor

If you would like to help add more file formats to the library, great!
Clone the repo, and to get started:

    npm install

Run the tests to make sure everything worked:

    npm test

You're ready to go!  To add a new file format:

 1. Create a new file in the `formats/` folder for your format.
    Copying an existing file that covers a similar format will help
    considerably.  If you're not sure, `arc-grp-build.js` is a good
    starting point as it is fairly simple.
    
 2. Edit `formats/index.js` and add an `import` statement for your new file.
    
 3. Make a folder in `test/` for your new format and populate it with files
    similar to the other formats.  The tests work by creating a standard
    archive file with some preset files in it, and comparing the result to
    what is inside this folder.
    
    You can either create these archives by hand, with another utility, or if
    you are confident that your code is correct, from the code itself.  This is
    done by setting an environment variable when running the tests, which will
    cause the archive file produced by your code to be saved to a temporary
    file in the current directory:
    
        # Prepare the location for the test files.
        mkdir test/arc-myformat/
        touch test/arc-myformat/default.bin   # Repeat for all needed files
        
        # Run the tests and save the output.
        SAVE_FAILED_TEST=1 npm test
        
        # Check the failed output and if it's correct, overwrite the expected
        # output with the test result.
        mv test/arc-myformat/default.bin.failed_test_output test/arc-myformat/default.bin
    
    It is helpful however, to create these files first before implementing your
    new format, as then you only need to keep running the tests and tweaking
    your code until all the tests pass.
    
 4. Create a file in `test/` for any extra tests your new format needs.
    Typically all formats will at least have tests that confirm the
    `identify()` function is correctly rejecting files, but you can also add
    additional tests here if your format needs it.  See
    [test-arc-pod-tv.js](test/test-arc-pod-tv.js) for a minimal example
    that only has tests for the `identify()` function, or
    [test-arc-dat-fast.js](test/test-arc-dat-fast.js) for an example with
    a number of extra tests, in this case testing that filenames are correctly
    converted into code numbers, something that is unique to that file format.
    
 5. Update the `README.md` with details of your new format and supported games.

If your file format has any sort of compression or encryption, these algorithms
should go into the [gamecomp.js](https://github.com/Malvineous/gamecompjs)
project instead.  This is to make it easier to reuse the algorithms, as many of
them (particularly the compression ones) are used amongst many unrelated file
formats.  All the gamecomp.js algorithms are available to be used by any format
in this library.

During development you can test your code like this:

    # Read a sample archive and list the files, with debug messages on
    $ DEBUG='gamearchive:*' ./bin/gamearch open -t arc-myformat example.dat list

    # Make sure the format is autodetected correctly or if not why not
    $ DEBUG='gamearchive:*' ./bin/gamearch identify example.dat

    # Run only unit tests for the new format, with debugging on
    $ DEBUG='gamearchive:*' npm test -- -g arc-myformat

If you use `debug()` rather than `console.log()` in your code then these
messages can be left in for future diagnosis as they will only appear when the
`DEBUG` environment variable is set correctly.

### Development tips

This is a list of some common issues and how they have been solved by some of
the format handlers:

##### Archive doesn't store filenames

* `dat-hocus` has a list of fake filenames that are assigned based on the
  index, with `unknown.123` used for any extra files.
* `lbr-vinyl` stores an integer hash instead of a filename, so a list of known
  filenames is used to convert the hash back into a name, with `unknown-123`
  used for any unmatched files.

##### Archive has duplicate filenames

* `res-stellar7` appends the order number to each filename, so two files called
  `SNG` become `SNG.0` and `SNG.1`.

##### Archive has folders

* `dat-fast` and `pod-tv` have the folder stored as part of the filename with a
  backslash as separator, so they are returned as-is (e.g. `digi\sound.voc`).
* `res-stellar7` has subfolders stored as separate FAT blocks so from these,
  filenames are generated that include the folder, e.g. `SSM.0/SNG.1`.
* `wad-doom` has empty files used for starting and ending a group of files,
  so to ensure these files are kept together they are converted into a virtual
  folder.  So files `P_STRT`, `EXAMPLE`, and `P_END` come out as `P/EXAMPLE`.
