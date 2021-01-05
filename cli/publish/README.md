This is just a dummy package to install only the devDependencies needed to run
the command-line interface.

It is intended to be installed globally with `npm install -g` (or via a Linux
distribution's package manager) to make the library's command-line interface
available anywhere on the system.

It avoids two problems:

  1. The dependencies only used by the CLI can be put in as `devDependencies`,
     so they don't have to be installed when the library is used by other
     projects, where the CLI isn't used anyway.

  2. All the other devDependencies (like the test framework and linting tools)
     don't get installed like they would if the library itself was installed in
     dev mode.

  3. The CLI can still be distributed with the core library so it can be easily
     used during development for testing new features.
