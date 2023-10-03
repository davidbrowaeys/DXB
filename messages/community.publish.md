# summary

Publish experience community to target environment. If not specified, then will fetch all "Live" communities from target env.

# examples

- Publish all live communities
  
  <%= config.bin %> <%= command.id %>

- Publish specific communities
  
  <%= config.bin %> <%= command.id %> --name portal1 --name partner1

# flags.name.summary

Contains the name of a community. If not specified, then will fetch all "Live" communities from target env
