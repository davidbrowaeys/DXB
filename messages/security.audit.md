# summary
Perform a comprehensive security audit of your Salesforce org configuration and metadata.

# description
This command analyzes your Salesforce org for security risks and compliance issues. It checks profiles, permission sets, field-level security, sharing rules, session settings, password policies, and Apex code for potential security vulnerabilities. The audit generates a detailed report with risk scores and remediation recommendations.

# examples
- Run full security audit on target org:

<%= config.bin %> <%= command.id %> --target-org myOrg --output-dir reports

- Run specific security categories:

<%= config.bin %> <%= command.id %> --target-org myOrg --categories profiles,permissions,apex

- Run audit with severity threshold for CI/CD:

<%= config.bin %> <%= command.id %> --target-org myOrg --severity-threshold high --format json

- Generate HTML report:

<%= config.bin %> <%= command.id %> --target-org myOrg --format html --output-dir security-reports

# flags.target-org.summary
Target org alias or username to audit.

# flags.categories.summary
Comma-separated list of audit categories to run (profiles, permissions, fields, sharing, guest-user, session, password, apex, remote-sites, connected-apps, trusted-urls, monitoring).

# flags.format.summary
Output format for the report (html, markdown, json).

# flags.output-dir.summary
Directory to save the generated report.

# flags.severity-threshold.summary
Minimum severity level to report (critical, high, medium, low). Exit with error code if findings exceed threshold.

# flags.include-recommendations.summary
Include remediation recommendations in the report.

# flags.source-path.summary
Path to local source for Apex security analysis. If not specified, reads package directories from sfdx-project.json and scans all classes directories found within them.

# error.noOrg
You must specify a target org using --target-org.

# error.invalidCategory
Invalid audit category: %s. Valid categories are: profiles, permissions, fields, sharing, guest-user, session, password, apex, remote-sites, connected-apps, trusted-urls, monitoring.

# error.queryFailed
Failed to query org data: %s

# error.thresholdExceeded
Security audit found %s findings at or above %s severity level.
