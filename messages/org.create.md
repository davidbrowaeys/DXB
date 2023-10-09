# summary

Create scratch org

# examples

- Include packages, mark the new org as default for your project and give it an alias
 
 <%= config.bin %> <%= command.id %> --include-packages --default-org --set-alias myscratchorg

- Assign a custom number of duration to the scratch org, mark it as default for your project and give it an alias
 
 <%= config.bin %> <%= command.id %> --duration-days 10 --default-org --set-alias myscratchorg

# flags.set-alias.summary

Alias of scratch org

# flags.include-packages.summary

Include packages from cli config file

# flags.default-org.summary

Mark as default org

# flags.duration-days.summary

Duration of the scratch org (in days) (default:30, min:1, max:30)

# flags.include-tracking-history.summary

Remove field tracking history tag from object

# log.welcome

Welcome to dxb CLI! We are now creating your scratch org %s...

# log.installing

Installing your (un)managed packages...

# log.installed

Successfully installed package %s

# log.fieldsetCreated

=== Fieldset created successfully: %s

# log.availableFields

=== Available Object Fields:
%s

# log.getFields

Retrieve schema for %s from %s

# log.createUser

Creating testing user...

# log.importData

Importing data from data plan...

# log.trackingHistory

Disabling Feed Tracking History for %s

# log.manualConfig

Due to some limitations with DX scratch org, you must enable manually the following feature(s) before to proceed:

# log.packages

Installing your %s legacy packages...

# log.closing

Thank you for your patience! You can now enjoy your scrath org. Happy coding!

# log.userCreated

User has been created: 

# log.roleNotFound

Default role not found

# log.noSetupData

No setup data...

# log.globalSchema

Retrieving global schema...

# log.result.prefix

==== Object Prefix:    %s

# log.result.objectname

==== Object Name:    %s

# error.installingPackage

Error while installing package %s

# error.installing

Unable to install (un)managed packages!

# error.createUser

Unable to create user on scratch org!

# error.importData

Unable to import data on scratch org!

# error.pushFailed

Unable to push source to org!

# error.packages

Unable to install your %s legacy packages!

# error.definitionFile

Scratch definition file does not exist!

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