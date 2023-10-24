# summary

Extends scanner-code plugin and throw error if severity 1 rule are met.

# examples

- Specify a file that contains code scanner results

<%= config.bin %> <%= command.id %> --file apex_pmd_results.json

- Specify a path to a JSON file that contains a list of Apex Classes to exclude.

<%= config.bin %> <%= command.id %> -f apex_pmd_results.json --excluded-files exclude_apex.json

# flags.file.summary

File path of code scanner results

# flags.excluded-files.summary

File path of classes to exclude

# flags.severity.summary

Severity threshold, if set to 3 it will throw an error for all violations where severity is 3 and lower

# flags.high-severity-rules.summary

Name of the rules you want to mark a high severity

# log.calculating

Calculating quality gate...

# log.noExcludedFiles

No excluded files found

# error.violations

We have detected some very bad violations in your code. Run sfdx scanner locally.
