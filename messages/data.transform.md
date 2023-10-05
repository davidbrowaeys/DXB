# summary

Transform field values from a given query
 
# examples

- Specify transform file, object name and SOQL query
  
  <%= config.bin %> <%= command.id %> --object-name Account --transform-file transform.json --query "select id from Account where Phone_Country__c = \'Australia\' limit 10"

- Specify a target org
  
  <%= config.bin %> <%= command.id %> -s Account -f transform.json -q "select id from Account where Phone_Country__c = \'Australia\' limit 10" --target-org sit

# flags.object-name.summary

Salesforce Object Name

# flags.query.summary

A valid SOQL query

# flags.transform-file.summary

Specify a JSON file where key = source field and value = mapping value

# log.success

CSV file successfully processed
