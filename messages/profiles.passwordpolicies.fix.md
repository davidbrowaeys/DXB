# summary

This command allows password policies deployment to ignore timestamp in file name

# examples

- Use the default path to fix all profile password policies
 
 <%= config.bin %> <%= command.id %>

- Use a specific path to fix all profile password policies
 
 <%= config.bin %> <%= command.id %> --source-dir src/passwordPolicies

# flags.source-path.summary

Path to profile password policy files

# warning.noFiles

No source files were found in %s
