# summary
Generate visual diagrams from Salesforce Flow metadata as HTML, SVG, PNG, or Mermaid format.

# description
This command parses Salesforce Flow metadata XML files and generates visual flowchart diagrams. The default HTML format provides an interactive visualization with zoom controls and download options. SVG and PNG formats require mermaid-cli (mmdc) to be installed. The diagrams show flow elements including decisions, screens, record operations, loops, waits, assignments, and subflows with color-coded styling.

# examples
- Generate interactive HTML diagram from local flow file:

<%= config.bin %> <%= command.id %> --flow-path force-app/main/default/flows/MyFlow.flow-meta.xml --output-dir docs/flows

- Generate HTML diagrams for all flows in a directory:

<%= config.bin %> <%= command.id %> --flow-dir force-app/main/default/flows --output-dir docs/flows

- Generate SVG image (requires mermaid-cli):

<%= config.bin %> <%= command.id %> --flow-path force-app/main/default/flows/MyFlow.flow-meta.xml --format svg --output-dir docs/flows

- Generate PNG image with dark theme:

<%= config.bin %> <%= command.id %> --flow-path force-app/main/default/flows/MyFlow.flow-meta.xml --format png --theme dark --output-dir docs/flows

- Retrieve flow from org and generate HTML diagram:

<%= config.bin %> <%= command.id %> --flow-name My_Flow --target-org myOrg --output-dir docs/flows

- Generate Mermaid markdown for documentation:

<%= config.bin %> <%= command.id %> --flow-path force-app/main/default/flows/MyFlow.flow-meta.xml --format mermaid --output-dir docs/flows

# flags.flow-path.summary
Path to a local Flow metadata XML file.

# flags.flow-dir.summary
Directory containing Flow metadata XML files.

# flags.flow-name.summary
API name of the Flow to retrieve from the org.

# flags.target-org.summary
Target org alias or username to retrieve flow from.

# flags.format.summary
Output format: html (interactive), svg, png (require mermaid-cli), mermaid, or plantuml.

# flags.output-dir.summary
Directory to save the generated diagrams.

# flags.include-labels.summary
Include element labels in the diagram nodes.

# flags.show-fault-paths.summary
Show fault connector paths in the diagram.

# flags.show-variables.summary
Show flow variables section in HTML output.

# flags.theme.summary
Color theme for the diagram: default, dark, forest, or neutral.

# error.noInput
You must provide either --flow-path, --flow-dir, or --flow-name to generate a diagram.

# error.flowNameRequiresOrg
When using --flow-name, you must also specify --target-org.

# error.fileNotFound
The specified flow file was not found: %s

# error.invalidFlowXml
The file does not contain valid Flow metadata: %s

# error.retrieveFailed
Failed to retrieve flow from Salesforce: %s
