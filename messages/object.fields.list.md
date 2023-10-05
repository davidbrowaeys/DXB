# summary

Retrieve list of fields of specified object.

# description

Override mdapi convert standard behavior that create a dup file if file exist already.
Instead it delete old file and remame .dup by actual file.

# examples

- Specify an object name to fetch the fields for
  
  <%= config.bin %> <%= command.id %> --object-name Account

- Specify a filter to only include fields that include the filter in the Name
  
  <%= config.bin %> <%= command.id %> -s Account --filter mail

- Specify a target org to retrieve from

  <%= config.bin %> <%= command.id %> -s Account -f mail --target-org myOrg

# flags.object-name.summary

Name of custom object

# flags.filter.summary

Search filter

# log.retrieveSchema

Retrieving %s fields from schema...