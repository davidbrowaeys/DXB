# summary

Run LWC Tests with Jest with additional options.

# description

The current Salesforce CLI only runs all LWC tests, which can cause pipelines to last longer than needed if not all tests should be run.
Developers can run the test they want through VS Code test execution or using the Jest CLI.
This command provides a wrapper to run all tests or specific ones.

# examples

- Run all LWC tests:
  <%= config.bin %> <%= command.id %>

- Run specific LWC tests:
  <%= config.bin %> <%= command.id %> --test lwcComponentOne --test lwcComponentTwo

- Produce error when tests fail:
  <%= config.bin %> <%= command.id %> --fail-on-error

# flags.test.summary

The location of the component to test.

# flags.fail-on-error.summary

When set, the command will raise an error if a test fails.

# flags.manifest.summary

Location of a package.xml file.

# flags.root-dir.summary

Specify the location of where the lwc directory is located.

# success

All tests ran without issues.

# error.issues

Not all tests are successful:
%s

# error.processManifest

Unable to process content from manifest

# error.invalidComponents

None of the specified tests were found. Please check if the input is correct

# warning.issues

Not all tests are successful:
%s
