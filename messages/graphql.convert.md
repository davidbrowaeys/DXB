# summary

Transform a SOQL Query to a GraphQL Query

# examples

- Specify any valid query

  <%= config.bin %> <%= command.id %> --query "SELECT Id, Account.Name, Contact.FirstName, Contact.LastName FROM Case WHERE Origin = 'Phone'"

# flags.query.summary

A valid SOQL query

# error.invalidSOQL

Invalid SOQL query format
