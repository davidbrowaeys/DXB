# summary

Find unused Apex classes and methods that are not referenced anywhere in the codebase.

# description

Analyzes your Apex codebase to identify classes and methods that are never referenced. This helps clean up technical debt by finding dead code that can be safely removed.

The command scans:
- Apex class references (inheritance, composition, method calls)
- Apex trigger references
- LWC JavaScript files (@wire, @AuraEnabled calls)
- Aura component controller references
- Visualforce pages and components

When connected to an org, it also checks:
- Flow Apex Actions
- Process Builder Apex Actions
- Scheduled Jobs

# flags.source-dir.summary

Directory to scan for Apex files. If not specified, scans all packageDirectories from sfdx-project.json.

# flags.target-org.summary

Org to query for additional references (flows, scheduled jobs, etc.).

# flags.include-tests.summary

Include test classes in the analysis.

# flags.output-format.summary

Output format: table, json, or csv.

# flags.output-file.summary

File path to write the results.

# flags.method-level.summary

Analyze at method level for more detailed results.

# examples

- Find unused Apex classes in the default source directory:

  <%= config.bin %> <%= command.id %>

- Find unused classes and methods with method-level analysis:

  <%= config.bin %> <%= command.id %> --method-level

- Find unused classes checking org references:

  <%= config.bin %> <%= command.id %> --target-org myOrg

- Export results to JSON:

  <%= config.bin %> <%= command.id %> --output-format json --output-file unused-apex.json

- Analyze a specific directory including test classes:

  <%= config.bin %> <%= command.id %> --source-dir src/main/default/classes --include-tests

# spinner.analyzing

Analyzing Apex codebase for unused code...

# spinner.stop.done

Analysis complete

# log.summary

Found %d potentially unused items

# log.warning

⚠️  Review before deletion - some classes may be called dynamically via Type.forName()

# error.noSourceDir

Source directory does not exist: %s

# error.noApexFiles

No Apex files found in the specified directory
