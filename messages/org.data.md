# summary

Replace variables in specific files

# description

Different orgs can require different settings i.e. hardcoded URLs. This command uses an environment mapping JSON file to replace variables placed in the metadata files with actual values depending on the environment that is passed to the command.

# examples

- Basic usage

<%= config.bin %> <%= command.id %> --config config/cty-env-mapping.json --environment SIT

# flags.config.summary

Path to config file

# flags.environment.summary

Set the environment for which rules in config file should apply to.

# log.welcome

Welcome to dxb CLI! We are now creating your scratch org %s...

# log.installing

Installing your (un)managed packages...

# log.processing

Processing: %s
