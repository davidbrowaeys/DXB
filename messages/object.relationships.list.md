# summary

Retrieve list of child relationships of a specified object.

# description

Override mdapi convert standard behavior that create a dup file if file exist already.
Instead it delete old file and remame .dup by actual file.

# examples

- Specify an object name to fetch the relationships for

  <%= config.bin %> <%= command.id %> --object-name Account

- Specify a filter to only include relationships that include the filter in the Name

  <%= config.bin %> <%= command.id %> -s Account --filter Contact

- Specify a target org to retrieve from

  <%= config.bin %> <%= command.id %> -s Account -f Contact --target-org myOrg

# flags.object-name.summary

Name of custom object

# flags.filter.summary

Search filter

# log.retrieveSchema

Retrieving %s child relationships from schema...
