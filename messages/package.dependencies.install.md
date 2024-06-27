# summary

Install package dependencies from sfdx-project.json

# examples

- Install the package dependencies inside sfdx-project.json to the connected org.

<%= config.bin %> <%= command.id %>

- Install the package dependencies inside sfdx-project.json to the target org.

<%= config.bin %> <%= command.id %> --target-org myOrg

# log.welcome

Replacing unspported metadata for scratch org i.e.: field update on specific user, send email from org wide email...

# log.installPackage

Successfully installed package %s

# log.packageVersion

Package version %s

# log.alias

Alias %s

# error.cannotInstall

Unable to install packages dependencies! %s

# error.errorInstall

Error while installing package %s
