# summary

This command generate delta package by doing git diff.

# examples

- Specify a specific tag

<%= config.bin %> <%= command.id %> --mode tags --delta-key mytag

- Specify a branch to compare with

<%= config.bin %> <%= command.id %> --mode branch --delta-key origin/master

- Specify an output directory

<%= config.bin %> <%= command.id %> -m branch -k origin/master --output-dir deltamanifest

- Specify a commit to compare with

<%= config.bin %> <%= command.id %> --mode commitid --delta-key 123456

# flags.mode.summary

A specific mode to base the delta on. Three options are available: commitid|tags|branch

# flags.delta-key.summary

Can hold specific values related to commit id, tags prefix or name, branch name

# flags.base-dir.summary

Path of base directory, i.e.: force-app/main/default

# flags.output-dir.summary

Output directory path of the delta package.xml to generate, i.e.: ./manifest

# flags.granular.summary

If true, then delta will be very granular for Custom Object, otherwise will deploy the whole object

# flags.destructive-changes.summary

Indicate if need to generate destructivePackage.xml (experimental not working yet)

# flags.rollback.summary

Indicate if rollback of previous changes is required

# error.invalidMode

Invalid mode: %s. We support only tags, branch and commitid as values.
