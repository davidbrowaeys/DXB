# summary

Retrieve key prefix of specified sobject or retrieve sobject from specified key

# examples

- Specify the SObject to get the prefix from

<%= config.bin %> <%= command.id %> --object-name Account

- Specify the prefix for which you want the object name for

<%= config.bin %> <%= command.id %> --prefix 001

# flags.object-name.summary

Name of custom object

# flags.prefix.summary

Prefix of the object

# log.fieldsetCreated

=== Fieldset created successfully: %s

# log.availableFields

=== Available Object Fields:
%s

# log.getFields

Retrieve schema for %s from %s

# log.globalSchema

Retrieving global schema...

# log.result.prefix

==== Object Prefix: %s

# log.result.objectname

==== Object Name: %s

# error.pushFailed

Unable to push source to org!

# error.prefixNotFound

Prefix not found.

# error.invalidArguments

You must specify either objectname or prefix.

# error.invalidConnection

Connection not valid.

# error.unexpected

Unexpected error

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
