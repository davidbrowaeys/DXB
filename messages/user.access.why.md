# summary

Find why a specified user has access to a field or object

# examples

- Request access explanation for a certain object

<%= config.bin %> <%= command.id %> --object-name Product2

- Request access explanation for a certain field on an object

<%= config.bin %> <%= command.id %> -s Product2 --field-name ExternalId\_\_c

- Request access explanation for a certain user

<%= config.bin %> <%= command.id %> -s Product2 --username johndoe@salesforceuser.com

# flags.object-name.summary

Salesforce API name of object, i.e.: Account, Invoice\_\_c

# flags.field-name.summary

Salesforce API name of object, i.e.: AccountId, Name

# flags.username.summary

Username of salesforce user. If not specified, will use the user connected to the org

# log.why

Why does %s have access to %s %s?

# error.connection

Connectons not established!

# spinner.start.scanning

Scanning org for user access

# spinner.stop.done

Done!
