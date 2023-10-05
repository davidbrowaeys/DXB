# summary

Import data to an org base on dxb data plan definition file.

# examples

- Use a specific data definition file and directory to load into Salesforce
  
  <%= config.bin %> <%= command.id %> --definition-file data/data-def.json --data-dir data/sit

- Load into a specific org
  
  <%= config.bin %> <%= command.id %> -f data/data-def.json -d data/sit --target-org devorg

- Specify a specific amount of time to poll (in ms)
  
  <%= config.bin %> <%= command.id %> -f data/data-def.json -d data/sit -o devorg --polling-time-out 10000

# flags.definition-file.summary

Path to a dxb data definition file

# flags.data-dir.summary

Path of data to import (in CSV format)

# flags.polling-time-out.summary

Bulk polling timeout in milliseconds

# log.importData

Import data to org...

# log.preparing

Preparing file...

# log.registerImport

Register import for %s

# log.loadResult

Imported: %s succeeded - %s failed

# log.batch

Batch %d out of %d...

# error.dataDirNotExist

This folder does not exist.

# error.splitStream

csvSplitStream failed! %s

# error.unexpected

Unexpected issue occurred: %s
