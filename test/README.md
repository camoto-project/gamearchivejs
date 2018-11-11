## Running the tests

You can run the tests through `npm`:

  npm test

If a test fails but the data is correct (such as after fixing bugs or
adding support for a new format), the testdata can be updated by
saving the failed data to a file:

  SAVE_FAILED_TEST=1 npm test

This will save the failed test to `error.bin` which can be used to
overwrite the old testdata file.
