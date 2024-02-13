# summary

This command removes fls and object permissions where all access are set to "false"

# examples

- Clean the permissions inside a specific permission set file.

<%= config.bin %> <%= command.id %> --file force-app/main/default/permissionsets/Social_Customer_Service_Permission_Set.permissionset-meta.xml

- Clean the permissions inside all permissionse files

<%= config.bin %> <%= command.id %> --root-dir src/permissionsets

- Clean the permissions inside a specific permissionset

<%= config.bin %> <%= command.id %> --permissionset-name RW_All

# flags.file.summary

File path of permissionset to clean

# flags.root-dir.summary

Source path to permissionsets metadata directory, i.e.: src/permissionsets or force-app/main/default/permissionsets

# flags.permissionset-name.summary

Permissionset name to clean

# log.couldNotFind

Could not find %s

# log.couldNotCleanup

Could not clean up %s: %s

# log.packageVersion

Package version %s

# log.alias

Alias

# error.cannotInstall

Unable to install packages dependencies! %s

# error.errorInstall

Error while installing package %s
