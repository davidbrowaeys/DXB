# summary

Export salesforce data using bulk api

# examples

- Use a specific Query

  <%= config.bin %> <%= command.id %> --query "select id from Account"

- Query a specific object

  <%= config.bin %> <%= command.id %> --object-name Contact

- Specify a specific org to run the query against:

  <%= config.bin %> <%= command.id %> -q "select id from Account" --target-org dev2

- Specify the output directory

  <%= config.bin %> <%= command.id %> -q "select id from Account" -o dev2 --output-dir ./dataoutputdir,

- Specify the output directory and output file name

  <%= config.bin %> <%= command.id %> -q "select id from Account" -o dev2 --output-dir ./dataoutputdir --file-name result.csv,

- Query all fields

  <%= config.bin %> <%= command.id %> -q "select id from Account" -o dev2 -d ./dataoutputdir -f result.csv --all-fields,

# flags.query.summary

SOQL query

# flags.object-name.summary

Object name

# flags.output-dir.summary

Bulk data output directory, default "output_dir"

# flags.file-name.summary

Name of the CSV file generated. If not specified, it will default to "<objectname>\_<timestamp>.csv"

# flags.all-fields.summary

Retrieve all fields from the object.

# error.name.invalidConnection

Invalid Connection

# error.name.invalidFlags

Invalid Flags

# error.name.invalidSOQL

Invalid SOQL

# error.message.noConfiguration

No configuration found for this org.

# error.message.queryOrObject

You must use either --query or --object-name.

# error.message.invalidSOQL

No sobject type found in query, maybe caused by invalid SOQL.
