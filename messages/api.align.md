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
  

# flags.metadata-type.summary

The types defined as the 'root' of the XML you want to target 

# flags.metadata-type.description

Select specific metadata type to align, value is the name of the root tag of the XML file holding the apiVersion tag i.e. <ApexClass ...

# flags.directory.summary

The directories that you want to target

# flags.directory.description

Path to one or multiple directories that need to be updated instead of package directories
