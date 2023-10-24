# summary

Create fieldset for specified object and push to scratch org.

# examples

- Use a specific data masking file, Object Name and Input File to mask

  <%= config.bin %> <%= command.id %> --definition-file config/data-masking-def.json --object-name Account --source-data bulk_output/ACCOUNT.csv

# flags.definition-file.summary

Path to a data masking definition file

# flags.object-name.summary

Object Name

# flags.source-data.summary

Path to a data source file

# log.initializingProcess

Initializing process...

# log.preparing

Preparing file...

# log.registerExport

Register export for %s

# log.exportResult

Total records exported: %s record(s)

# error.objectNotFound

Data masking definition not found for this object.
