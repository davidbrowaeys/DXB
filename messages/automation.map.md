# summary

Map all automation (triggers, flows, workflows, validation rules) per object with interactive visualization.

# description

Generates a comprehensive interactive HTML map of all automation configured for Salesforce objects. This helps understand the automation landscape, identify potential conflicts, and visualize relationships between components.

The command analyzes from local workspace:
- Apex Triggers (parses trigger files for execution phases)
- Record-Triggered Flows (parses flow XML files)
- Apex Classes (for relationship analysis)

When connected to an org, it also queries:
- Validation Rules
- Workflow Rules (legacy)
- Process Builders (legacy)
- Approval Processes

The output is an interactive HTML report with:
- vis.js network diagram showing relationships
- Clickable nodes that highlight in the table
- Conflict detection and warnings
- Statistics dashboard

# flags.target-org.summary

Salesforce org to query for additional automation (validation rules, workflows, etc.).

# flags.object-name.summary

Specific object to analyze. If not specified, analyzes all objects with automation.

# flags.component-name.summary

Specific component (class, trigger, or LWC) to analyze. Shows all direct and indirect relationships (callers and callees).

# flags.output-file.summary

Output HTML file path for the interactive automation map.

# flags.active-only.summary

Only show active automation (excludes inactive flows, workflows, etc.).

# examples

- Map automation from local workspace only:

  <%= config.bin %> <%= command.id %>

- Map automation with org data for a specific object:

  <%= config.bin %> <%= command.id %> --target-org myOrg --object-name Account

- Map all automation across all objects:

  <%= config.bin %> <%= command.id %> --target-org myOrg

- Export to custom file path:

  <%= config.bin %> <%= command.id %> --target-org myOrg --output-file reports/automation-map.html

- Show only active automation:

  <%= config.bin %> <%= command.id %> --target-org myOrg --active-only

- Show all relationships for a specific Apex class:

  <%= config.bin %> <%= command.id %> --component-name AccountService

- Show all relationships for a trigger:

  <%= config.bin %> <%= command.id %> --component-name AccountTrigger

- Show all relationships for an LWC component:

  <%= config.bin %> <%= command.id %> --component-name accountCard

# spinner.analyzing

Analyzing automation...

# spinner.stop.done

Analysis complete

# log.summary

Found %d automation items across %d objects

# log.conflicts

⚠️  %d potential conflicts detected

# log.noAutomation

No automation found for the specified criteria

# error.connection

Unable to connect to org. Please check your authentication.

# error.objectNotFound

Object not found: %s
