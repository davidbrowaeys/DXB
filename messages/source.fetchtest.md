# summary

Calculate specified test classes base on source path. This command is to use after source:delta.

# examples

- Specify a file to retrieve the related test classes for
 
 <%= config.bin %> <%= command.id %> --source-path force-app/main/default/classes/GenericApex.cls

- Specify a manifestfile that contains metadata types to search through

 <%= config.bin %> <%= command.id %> --manifest manifest/package.xml

- Filter metadata types to use

 <%= config.bin %> <%= command.id %> -x manifest/package.xml --metadata-type classes

- Include a regex to specify test class naming convention

 <%= config.bin %> <%= command.id %> -x manifest/package.xml -t classes -n "*.T"

# flags.source-path.summary

Content that contains reference(s) to Apex Tests.

# flags.manifest.summary

File path for manifest (package.xml) of components to retrieve

# flags.base-dir.summary

Path of base directory, i.e.: force-app/main/default

# flags.metadata-type.summary

Directory name of the metadata to be used in the search

# flags.test-class-name-regex.summary

Regex for test classes naming convention

# error.requiredFlags

Sourcepath or manifest is required

# error.processManifest

Unable to process content from manifest
