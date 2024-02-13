# summary

Create a permission set from a profile without layout and category group visiblity

# examples

- Create a named permissionset from an existing profile

<%= config.bin %> <%= command.id %> --profile force-app/main/default/profile/Admin.profile-meta.xml --permissionset-name AdminPermissionSet

# flags.profile.summary

File path of profile to create the permission set from

# flags.permissionset-name.summary

Name of the permision set to create

# flags.output-dir.summary

Output path of the permision set to create

# flags.has-activation-required.summary

Indicates whether the permission set requires an associated active session or not. This field is available in API version 53.0 and later.

# flags.license.summary

License name of the permision set to create

# flags.description.summary

Description of the permission set to create

# log.description

Permission Set created from %s

# log.success

Permissionset created: %s
