# summary

Scan Apex Classes for Queries and explain them

# description

This method goes through all Apex Classes stored in the project and checks if it they contain SOQL queries.
For all queries, a call is made to Salesforce to retrieve the query plan for each query.

# examples

- <%= config.bin %> <%= command.id %>

# class

Class: %s

# query

Query: %s
