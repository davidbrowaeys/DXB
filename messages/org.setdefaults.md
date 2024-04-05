# summary

Set default username and org wide email in metadata such as workflow based on target scratch org

# examples

- Use the default package directory from project.json on your default org
 
 <%= config.bin %> <%= command.id %>

- Specify a directory that contains metadata to replace with default values for your default org
 
 <%= config.bin %> <%= command.id %> --base-dir src

- Specify a target org when modifying metadata with default values
 
 <%= config.bin %> <%= command.id %> --d src --target-org myOrg

# flags.base-dir.summary

Path of base directory

# log.welcome

Replacing unspported metadata for scratch org i.e.: field update on specific user, send email from org wide email...

# error.badConfig

Plugin definition dxb is missing in sfdx-project.json, make sure to setup plugin.

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

# prompt.message.continue

Would you like to continue? (Y/N)

# prompt.message.description

Description: 