# summary

Extract certificates from partner community. You must have access to parner commuunity in order to use this command.

# examples

- Use the path to a data backup folder
  
  <%= config.bin %> <%= command.id %> --backup-dir backup/cycle-1

- Specify a target org
  
  <%= config.bin %> <%= command.id %> -d backup/cycle-1 --target-org myOrg

# flags.backup-dir.summary

Path to a data backup cycle root folder

# flags.object-name.summary

Object Name

# flags.source-data.summary

Path to a data source file

# log.loadSuccessful

Record nr. %d loaded successfully, id = %s

# log.loadFailed

Record nr. %d error occurred, message = %s

# error.unexpected

Unexpected issue occurred: %s