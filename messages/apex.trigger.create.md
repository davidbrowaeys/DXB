# summary

Create trigger and apex class from template.

# description

This command creates a trigger and accompanying apex class. Specify the object name according to it's domain layer.

# examples

- Specify an sobject:
  
  <%= config.bin %> <%= command.id %> --sobject Account

- Specify an API version for the generated files:

  <%= config.bin %> <%= command.id %> -s Account --source-api-version 59.0

# flags.sobject.summary

API name of the SObject

# flags.source-api-version.summary

Set the API version of the specified class and trigger

# error.templateNotExist

Specified template 'trigger' doesn't exist

# error.defJsonNotFound

def.json not found

# error.defJSONVars

The following variables are required: %s. Specify them like: -v className=myclass,apiName=40.0

