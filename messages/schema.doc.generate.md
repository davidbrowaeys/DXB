# summary

This command-line can generate technical design documentation for a Salesforce org. The tool retrieves metadata information about standard and custom objects, Apex classes, triggers, REST resources, named credentials, and connected apps from the org and then creates a PDF document containing the collected information. The tool uses the pdfmake library to generate the PDF document based on an HTML template and a CSS stylesheet. To start using this command, run sf dxb install or copy schema gen def json file from Github: https://github.com/davidbrowaeys/DXB/blob/master/src/lib/documentinfo.json.

# examples

- Specify a path to the pdf configuration file
 
 <%= config.bin %> <%= command.id %> --target-org myenv --pdf-config config/documentinfo.json',

- Specify a package.xml file

 <%= config.bin %> <%= command.id %> -o myenv -c config/docmentinfo.json -x manifest/package.xml

# flags.pdf-config.summary

A required string parameter that represents the file path of a JSON configuration file for the PDF document generation.

# flags.stylesheet.summary

An optional string parameter that represents the file path of a stylesheet for the generated HTML document. If not specified, the default Bootstrap stylesheet will be used

# flags.html-template.summary

An optional string parameter that represents the file path of an HTML template for the PDF document generation. If not specified, the default DXB template will be used.

# flags.manifest.summary

File path of manifest(package.xml) to generate the PDF document for. If not specified, DXB will consider all custom objects (except managed packages).

# flags.format.summary

Format of the generated doc, options : pdf, html, docx.

# log.readFile

Read file %s

# log.createdFolder

Created profile folder: %s.profile-meta.xml

# log.converted

Converted: %s

# warning.ignored

%s ignored!

# error.invalidFormat

Invalid format: %s. We support only html, pdf and docx.

# error.noHTMLTemplate

HTML Template not found: %s

# error.noStylesheetTemplate

Stylesheet file not found: %s

# error.noPDFConfig

PDF Metadata Config Json file not found: %s

# error.metadata.incorrectStandard

You must define list of standard objects as follow "metadata": { stdobjects: ["Account","Contact"]} in your pdf document: %s

# spinner.start.createDoc

Create %s document

# spinner.start.retrieveApex

Retrieve Apex classes and triggers

# spinner.start.retrieveAura

Retrieve Aura Component info

# spinner.start.retrieveConnected

Retrieve connected apps

# spinner.start.retrieveCustom

Retrieve custom object list

# spinner.start.retrieveCustomMetadata

Retrieve custom object metadata

# spinner.start.retrieveFlow

Retrieve flow and process builders

# spinner.start.retrieveInfo

Retrieve organization info

# spinner.start.retrieveNameCredentials

Retrieve name credentials

# spinner.start.retrieveStandard

Retrieve standard object list

# spinner.start.retrieveStandardMetadata

Retrieve standard object metadata

# spinner.stop.done

Done

# spinner.stop.found

%d found!
