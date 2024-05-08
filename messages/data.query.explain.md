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

# log.overview
How Query Plan works ? 

Cardinality: The estimated number of records that the leading operation type would return. For example, the number of records returned if using an index table.
Fields: The indexed field(s) used by the Query Optimizer. If the leading operation type is Index, the fields value is Index. Otherwise, the fields value is null.
Leading Operation Type: The primary operation type that Salesforce will use to optimize the query.
Relative Cost: The cost of the query compared to the Force.com Query Optimizer’s selectivity threshold. Values above 1 mean that the query won’t be selective.
Object Cardinality: The approximate record count for the queried object.

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
