# summary

Align component API versions

# description

Align the API version of components with the API version defined in sfdx-project.json. Add full file paths to plugins.dxb.apiAlignmentExclusion to exclude specific files.

# examples

- Align all components in the project with the API defined in sfdx-project.json:
  
  <%= config.bin %> <%= command.id %>

- Specify one or multiple metadata types to align:

  <%= config.bin %> <%= command.id %> --metadata-type ApexClass --metadata-type ApexTrigger

- Specify directories and files to align:

  <%= config.bin %> <%= command.id %> --directory src/main --directory force-app/main/default/classes/ClassName.meta-xml
  

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

