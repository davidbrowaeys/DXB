# summary

Create a new custom object.

# description

Create a new custom object, prompting the user for specific object settings

# examples

- Specify the SObject to create

<%= config.bin %> <%= command.id %> --object-name Invoice

- Choose if you want to push the new Object to the connected org

<%= config.bin %> <%= command.id %> -s Invoice --push

- Specify a target org to deploy to

<%= config.bin %> <%= command.id %> -s Invoice -p --target-org myOrg

# flags.object-name.summary

Name of custom object

# flags.push.summary

Push the changes to the target org

# log.objectCreated

=== Custom Object created successfully: %s

# log.sharingControlledByParent

When sharing model is set as controlled by parent, you must define master details :

# error.pushFailed

Unable to push source to org!

# error.exists

This object already exists

# data.object

<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
  <actionOverrides>
    <actionName>Accept</actionName>
    <type>Default</type>
  </actionOverrides>
  <actionOverrides>
    <actionName>CancelEdit</actionName>
    <type>Default</type>
  </actionOverrides>
  <actionOverrides>
    <actionName>Clone</actionName>
    <type>Default</type>
  </actionOverrides>
  <actionOverrides>
    <actionName>Delete</actionName>
    <type>Default</type>
  </actionOverrides>
  <actionOverrides>
    <actionName>Edit</actionName>
    <type>Default</type>
  </actionOverrides>
  <actionOverrides>
    <actionName>List</actionName>
    <type>Default</type>
  </actionOverrides>
  <actionOverrides>
    <actionName>New</actionName>
    <type>Default</type>
  </actionOverrides>
  <actionOverrides>
    <actionName>SaveEdit</actionName>
    <type>Default</type>
  </actionOverrides>
  <actionOverrides>
    <actionName>Tab</actionName>
    <type>Default</type>
  </actionOverrides>
  <actionOverrides>
    <actionName>View</actionName>
    <type>Default</type>
  </actionOverrides>
  <allowInChatterGroups>false</allowInChatterGroups>
  <compactLayoutAssignment>SYSTEM</compactLayoutAssignment>
  <deploymentStatus>Deployed</deploymentStatus>
  <description>{{description}}</description>
  <enableActivities>true</enableActivities>
  <enableBulkApi>true</enableBulkApi>
  <enableChangeDataCapture>false</enableChangeDataCapture>
  <enableFeeds>false</enableFeeds>
  <enableHistory>true</enableHistory>
  <enableReports>true</enableReports>
  <enableSearch>true</enableSearch>
  <enableSharing>true</enableSharing>
  <enableStreamingApi>true</enableStreamingApi>
  <label>{{label}}</label>
  <nameField>
    <label>{{label}} Name</label>
    <type>Text</type>
  </nameField>
  <pluralLabel>{{label}}s</pluralLabel>
  <searchLayouts/>
  <sharingModel>{{sharingmodel}}</sharingModel>
</CustomObject>

# data.master

<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
  <fullName>{{fieldname}}</fullName>
  <externalId>false</externalId>
  <label>{{fieldlabel}}</label>
  <referenceTo>{{masterobject}}</referenceTo>
  <relationshipLabel>{{relationshipLabel}}</relationshipLabel>
  <relationshipName>{{relationshipName}}</relationshipName>
  <relationshipOrder>0</relationshipOrder>
  <reparentableMasterDetail>true</reparentableMasterDetail>
  <trackHistory>false</trackHistory>
  <trackTrending>false</trackTrending>
  <type>MasterDetail</type>
  <writeRequiresMasterRead>false</writeRequiresMasterRead>
</CustomField>

# prompt.message.masterObject

Master object(API name), i.e.: Account, Invoice\_\_c:

# prompt.message.masterLabel

Master field label:

# prompt.message.relationshipName

Relationship name(i.e.:"Drawdowns", "Invoice Lines")

# prompt.message.sharingModel

Sharing Model (Private|Public|ControlledByParent):

# prompt.message.description

Description:
