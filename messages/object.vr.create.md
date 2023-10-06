# summary

This command create a validation rule against specified object.

# description

Override mdapi convert standard behavior that create a dup file if file exist already.
Instead it delete old file and remame .dup by actual file.

# examples

- Specify the SObject and name for the Validation Rule
  
  <%= config.bin %> <%= command.id %> --name BlockNameChange --object-name Account

- Choose if you want to push the new Validation Rule to the connected org
  
  <%= config.bin %> <%= command.id %> -s Account -n BlockNameChange --push

- Specify a target org to deploy to

  <%= config.bin %> <%= command.id %> -s Account -n BlockNameChange -p --target-org myOrg

# flags.object-name.summary

Name of custom object

# flags.name.summary

Name of the validation rule

# flags.push.summary

Push the changes to the target org

# log.vrCreated

Validation Rule created successfully at %s

# error.pushFailed

Unable to push source to org!