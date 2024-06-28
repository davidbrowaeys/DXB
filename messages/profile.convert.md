# summary

Convert profile xml into small chunks of json files

# examples

- Use the default path to split the profile XML into separate JSON files

<%= config.bin %> <%= command.id %>

- Specify a path that contains profile XML

<%= config.bin %> <%= command.id %> --source-dir src/profiles

- Specify a specific Profile name to be converted to JSON files

<%= config.bin %> <%= command.id %> --profile-name Admin

# flags.profile-name.summary

Profile name to be converted

# flags.source-dir.summary

Path to profile files

# log.readFile

Read file %s

# log.createdFolder

Created profile folder: %s.profile-meta.xml

# log.converted

Converted: %s

# warning.noFiles

No source files were found in %s

# error.couldNotConvert

Could not convert %s

# error.profileNotExist

Profile does not exist.

# error.couldNotSplit

Could not split %s
