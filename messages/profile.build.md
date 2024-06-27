# summary

Convert Profile in JSON format to one XML

# examples

- Use the default path to build the profile from every Profile JSON

<%= config.bin %> <%= command.id %>

- Specify a path that contains profile JSON

<%= config.bin %> <%= command.id %> --source-dir src/profiles

- Specify a specific Profile name to be converted to XML

<%= config.bin %> <%= command.id %> --profile-name Admin

# flags.profile-name.summary

Profile name to be converted

# flags.source-dir.summary

Path to profile files

# warning.noFiles

No source files were found in %s
