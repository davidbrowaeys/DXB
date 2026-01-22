# summary
Generate a deployment report from Salesforce deployment results in HTML or Markdown format.

# description
This command generates a comprehensive deployment report from either a Salesforce deployment job ID or a local JSON file containing deployment results. The report includes deployment summary, component details, test results, code coverage, and error information.

# examples
- Generate HTML report from deployment job ID:

<%= config.bin %> <%= command.id %> --job-id 0Af1234567890ABCDEF --target-org myOrg --format html --output-dir reports

- Generate Markdown report from local JSON file:

<%= config.bin %> <%= command.id %> --json-file deployment-result.json --format markdown --output-dir reports

- Generate report with JUnit test results and Cobertura coverage:

<%= config.bin %> <%= command.id %> --json-file deploy-result.json --junit-file test-results.xml --cobertura-file coverage.xml --output-dir reports

- Generate report with Code Analyzer results:

<%= config.bin %> <%= command.id %> --json-file deploy-result.json --code-analyzer-file ca-results.csv --format html --output-dir reports

- Generate comprehensive CI/CD report with all data sources:

<%= config.bin %> <%= command.id %> --job-id 0Af123 --target-org myOrg --junit-file junit.xml --cobertura-file cobertura.xml --code-analyzer-file ca-results.csv --output-dir reports

# flags.job-id.summary
The deployment job ID (AsyncResult ID) to fetch results from Salesforce.

# flags.json-file.summary
Path to a local JSON file containing deployment results (from sf project deploy report --json).

# flags.junit-file.summary
Path to a JUnit XML file containing test results.

# flags.cobertura-file.summary
Path to a Cobertura XML file containing code coverage data.

# flags.code-analyzer-file.summary
Path to a Salesforce Code Analyzer CSV file containing static analysis results.

# flags.format.summary
Output format for the report (html or markdown).

# flags.output-dir.summary
Directory to save the generated report.

# flags.target-org.summary
Target org alias or username to fetch deployment results from.

# flags.include-coverage.summary
Include detailed code coverage information in the report.

# flags.title.summary
Custom title for the report.

# error.noInput
You must provide either --job-id or --json-file to generate a report.

# error.bothInputs
You cannot provide both --job-id and --json-file. Please use only one input source.

# error.jobIdRequiresOrg
When using --job-id, you must also specify --target-org.

# error.fileNotFound
The specified JSON file was not found: %s

# error.invalidJson
The JSON file contains invalid JSON: %s

# error.fetchFailed
Failed to fetch deployment result from Salesforce: %s

# error.invalidJunit
The JUnit XML file is invalid: %s

# error.invalidCobertura
The Cobertura XML file is invalid: %s

# error.invalidCodeAnalyzer
The Code Analyzer CSV file is invalid: %s
