# summary

Export data from an org base on dxb data plan definition file.

# examples

- Use a specific data definition file and directory to load into Salesforce

  <%= config.bin %> <%= command.id %> --definition-file data/data-def.json --data-dir data/sit

- Load into a specific org

  <%= config.bin %> <%= command.id %> -f data/data-def.json -d data/sit --target-org devorg

- Specify a specific amount of time to poll (in ms)

  <%= config.bin %> <%= command.id %> -f data/data-def.json -d data/sit -o devorg --polling-time-out 10000

# flags.definition-file.summary

Path to a dxb data definition file

# flags.output-dir.summary

Path of export directory

# flags.query-limit.summary

Maximum number of records to fetch

# log.importData

Import data to org...

# log.preparing

Preparing file...

# log.registerExport

Register export for %s

# log.exportResult

Total records exported: %s record(s)
