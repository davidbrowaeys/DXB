# summary

Extract certificates from partner community. You must have access to parner community in order to use this command.

# examples

- Use a specific data definition file and directory to do a full backup from Salesforce
  
  <%= config.bin %> <%= command.id %> --mode full --data-dir backup --definition-file config/backup-def.json

- Load into a specific org
  
  <%= config.bin %> <%= command.id %> -m full -d backup -f config/backup-def.json -o myOrg

- Use delta mode 
  
  <%= config.bin %> <%= command.id %> -m delta -d backup -f config/backup-def.json

# flags.definition-file.summary

Path to a data backup definition file

# flags.data-dir.summary

Path to main data backup directory

# flags.mode.summary

Data backup mode, accepted values are delta or full

# flags.output-dir.summary

Path to main data backup directory

# log.importData

Import data to org...

# log.preparing

Preparing file...

# log.registerImport

Register import for %s

# log.loadResult

Imported: %s succeeded - %s failed

# log.deltaFor

Retrieve delta for %s

# error.invalidMode

Invalid backup mode specified. You can only select delta or full backup.

# error.noBackupFile

No backup configuration found in %s for this user

# error.unexpected

Unexpected issue occurred: %s
