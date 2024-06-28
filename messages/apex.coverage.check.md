# summary

Read a cobertura xml file and check if any class coverage is below the minumum threshold.

# description

This method read cobertura xml file and check if any class coverage is below the minumum threshold.

# flags.file-path.summary

Path of xml file

# flags.min-coverage.summary

Minimum apex coverage in %

# examples

- Specify a cobertura file:

  <%= config.bin %> <%= command.id %> --file-path tests/coverage/cobertura.xml

- Specify a cobertura file with minimum code coverage:

  <%= config.bin %> <%= command.id %> --file-path tests/coverage/cobertura.xml --min-coverage 99

# coverageTooLow

Ooops, coverage seems a bit low! Each apex class is expected at least a coverage of %d.

# coverageIsOk

Code coverage is looking good!

# insufficientCoverage

Insufficient Code Coverage!
