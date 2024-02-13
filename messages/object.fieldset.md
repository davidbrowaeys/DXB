# summary

Create a new fieldset for an object. Push to org if needed.

# examples

- Specify the SObject to create

<%= config.bin %> <%= command.id %> --object-name Account --fieldset-name FS_1

- Choose if you want to push the new Object to the connected org

<%= config.bin %> <%= command.id %> -s Account -n FS_1 --push

- Specify a target org to deploy to

<%= config.bin %> <%= command.id %> -s Account -n FS_1 -p --target-org myOrg

- Display all fields on the Object before creating the field set

<%= config.bin %> <%= command.id %> -s Account -n FS_1 -p --retrieve-fields

# flags.object-name.summary

Name of custom object

# flags.fieldset-name.summary

Name of fieldset

# flags.retrieve-fields.summary

Retrieve and display sobject fields in terminal

# flags.push.summary

Push the changes to the target org

# log.fieldsetCreated

=== Fieldset created successfully: %s

# log.availableFields

=== Available Object Fields:
%s

# log.getFields

Retrieve schema for %s from %s

# error.pushFailed

Unable to push source to org!

# error.exists

This object already exists

# data.fieldset

<?xml version="1.0" encoding="UTF-8"?>
<fieldSets xmlns="http://soap.sforce.com/2006/04/metadata">
  <fullName>{{fullname}}</fullName>
  <description>{{description}}</description>
  {{fieldlist}}
  <label>{{label}}</label>
</fieldSets>

# prompt.message.fields

Fields (APIName with comma separated):

# prompt.message.description

Description:
