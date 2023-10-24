# summary

Create static resource

# examples

- Specify information on the static resource files to be created

<%= config.bin %> <%= command.id %> --name MyImage --target-dir "My Logo" --file "/img/logo.png"

- Push the created source to the connected org

<%= config.bin %> <%= command.id %> -n MyImage -d "My Logo" -f "/img/logo.png" --push

- Specify a directory to place the created files in

<%= config.bin %> <%= command.id %> -n MyImage -d "My Logo" -f "/img/logo.png" --target-dir src/staticresources

# flags.name.summary

Name of the static resource

# flags.file.summary

Local file path of the static resource

# flags.push.summary

If used, the created files will be pushed to the connected org

# flags.target-dir.summary

Path to directory to store created files

# log.filesCreated

The following files were created:%s

# log.noExcludedFiles

No excluded files found

# error.contentType

Content-type not supported.

# error.pushFailed

Unable to push source to org!

# content

<?xml version="1.0" encoding="UTF-8"?>
<StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
  <contentType>{{content_type}}</contentType>
  <description>{{description}}</description>
</StaticResource>
