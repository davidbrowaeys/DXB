# summary

CLI version of the salesforce query plan tool to optimize and speed up queries.

# examples

- Use a specific query

  <%= config.bin %> <%= command.id %> --query "select id from Account where BillingCountry = \'Australia\' limit 10"

- Query against a specific org

  <%= config.bin %> <%= command.id %> -q "select id from Account where BillingCountry = \'Australia\' limit 10" --target-org myOrg

# flags.query.summary

A valid SOQL query

# log.successful

All files downloaded successfully.

# log.connecting

Connecting to org...

# log.noExplanation

No Query explanation available

# log.connected

Connected to %s...
Access Token: %s

# error.queryNotValid

Connection not valid.

# error.unexpected

Unexpected issue occurred

# error.missingQueryFlag

Must specify query in order to use this command.
