# DXB-CLI

A cli plugin for the Salesforce CLI built by David Browaeys containing a lot of helpful commands.

# Table of Contents

- [Pre-requisite](#pre-requisite)
- [Install DXB-CLI](#install-dxb-cli)
- [Setup SFDX Project for DXB-CLI](#setup-sfdx-project-for-dxb-cli)
  - [Options](#options)
  - [Sample Definition Output](#sample-definition-output)
- [Topics](#topics)
  - [Create DXB Scratch Org](#create-dxb-scratch-org)
  - [Profile](#profile)
  - [User Access Check](#user-access-check)
  - [Clean your permission sets](#clean-your-permission-sets)
  - [Data Transfer (Export & Import)](#data-transfer-export--import)
    - [Setup](#setup)
    - [Export](#export)
    - [Import](#import)
    - [Azure Pipeline](#azure-pipeline)
  - [Delta Deployment](#delta-deployment)
  - [Schema Doc Gen](#schema-doc-gen)

## Pre-requisite

1. Install [SDFX CLI](https://developer.salesforce.com/tools/sfdxcli)

2. Install [node.js. + npm](https://nodejs.org/en/).
   Once installed, checkout proxy setting if you are behind corporate proxy.

## Install DXB-CLI

```shell
sfdx plugins:install dxb@latest
```

## Setup SFDX Project for DXB-CLI

Some of the commands required some configuration. So in order to fully utilize DXB-CLI, you must run the following command. This will update sfdx-project.json and set DXB-CLI definition json.

```shell
sfdx dxb:install
```

### Options

- _defaultdurationdays_: override default scratch org duration to 30
- _packages_: list of managed package id's for scratch org creation
- _userPermissionsKnowledgeUser_ : mark scratch org user as Knowledge User
- _deferPermissionSet_ : path of defer shring rule permission set metadat to deploy, i.e.: force-app/main/default/permissionsets/Manage_Defer_Sharing_Permissions.permissionset-meta.xml
- _deferSharingUser_ : name of the defer shring rule permission set
- _manual_config_required_: dxb scratch org creation in the event process required a manual pre deployment
- _manual_config_start_url_: override default url when opening scratch org
- _manual_steps_: this attribute can be use to document manul pre deployment steps when using dxb org creation command. Only work along with _manual_config_start_url_.
- _apextemplatepath_: path to apex class template creation,i.e.:
- _orgdefault_config_: this attribute allow to define a set of rule to override certain metadata attribute specific to scratch org creation that might not be supported, i.e. field update to assign record to specific user.
  - _folder_ : name of the metadata folder to look at
  - _rules_ : set of rule for that metadata type
    - _regex_ : regex to evaluate,i.e.: <runAsUser>.+</runAsUser>
    - _replaceby_ : value to replace metadata attribute found by, use {{mergevalue}} in order to dynamically populate with the value define by mergefield
    - _mergefield_ : name of the attribute to populate, only support username at this stage from scratch org username, but this could be extended with other in the future.

### Sample Definition Output

```json
{
  "packageDirectories": [
    {
      "path": "force-app",
      "default": true
    }
  ],
  "namespace": "",
  "sfdcLoginUrl": "https://test.salesforce.com",
  "sourceApiVersion": "45.0",
  "plugins": {
    "dxb": {
      "defaultdurationdays": "30",
      "packages": [],
      "pre_legacy_packages": [],
      "userPermissionsKnowledgeUser": true,
      "deferPermissionSet": "force-app/main/default/permissionsets/Manage_Defer_Sharing_Permissions.permissionset-meta.xml",
      "deferSharingUser": "Manage_Defer_Sharing_Permissions",
      "disableFeedTrackingHistory": [],
      "manual_config_required": false,
      "manual_config_start_url": "/ltng/switcher?destination=classic&referrer=%2Flightning%2Fsetup%2FSetupOneHome%2Fhome",
      "manual_steps": ["- Sample: Chatter Settings > Enable Unlisted Groups"],
      "data_plan_path": "./data/sample/data-plan.json",
      "apextemplatepath": null,
      "orgdefault_config": [
        {
          "folder": "workflow",
          "rules": [
            {
              "regex": "<lookupValue>.+</lookupValue>",
              "replaceby": "<lookupValue>{{mergevalue}}</lookupValue>",
              "mergefield": "username"
            },
            {
              "regex": "<senderType>.+</senderType>",
              "replaceby": "<senderType>CurrentUser</senderType>"
            }
          ]
        },
        {
          "folder": "emailservices",
          "rules": [
            {
              "regex": "<runAsUser>.+</runAsUser>",
              "replaceby": "<runAsUser>{{mergevalue}}</runAsUser>",
              "mergefield": "username"
            }
          ]
        },
        {
          "folder": "autoResponseRules",
          "rules": [
            {
              "regex": "<senderEmail>.+</senderEmail>",
              "replaceby": "<senderEmail>{{mergevalue}}</senderEmail>",
              "mergefield": "username"
            },
            {
              "regex": "<senderEmail>.+</senderEmail>",
              "replaceby": "<senderEmail>{{mergevalue}}</senderEmail>",
              "mergefield": "username"
            }
          ]
        },
        {
          "folder": "dashboards",
          "rules": [
            {
              "regex": "<dashboardType>LoggedInUser</dashboardType>",
              "replaceby": "<dashboardType>SpecifiedUser</dashboardType>"
            }
          ]
        },
        {
          "folder": "approvalProcesses",
          "rules": [
            {
              "regex": "<name>.+</name><!--username-->",
              "replaceby": "<name>{{mergevalue}}</name>",
              "mergefield": "username"
            }
          ]
        }
      ]
    }
  }
}
```

## Topics

```shell
  sfdx dxb:apex        A set of commands that allow to manilpulate apex.
  sfdx dxb:community   Publish community(network) using connect api.
  sfdx dxb:data        A set of commands that allows to manipulate and optimize data.
  sfdx dxb:mdapi       A set of commands that extends dx mdapi topic.
  sfdx dxb:object      A set of commands in regards to salesforce objects.
  sfdx dxb:org         A set of commands for scratch org and sandbox
  sfdx dxb:permission  Find out why a user has access to a object or field.
  sfdx dxb:profile     A set of commands that allow to manipuilate and faciliate salesforce profiles.
  sfdx dxb:static      Create static resource locally
  sfdx dxb:user        set defaut username and org wide email in metadata such as workflow based on target scratch org
```

### Create DXB Scratch Org

Creating a scratch can be vey tidious and might required a lot of steps especially if you have managed package to install. The purpose of this command is to remove those long tasks into a single one. In order to use the command you must config dxb plugin within your sfdx-project.json file.

- defaultdurationdays: override default duration to n days
- packages: list of managed package id
- manual_config_required: if true, prompt user to execute manual steps in scratch org.
- manual_config_start_url: start URL when open scratch org for manual pre config
- manual_steps : list manual config to perform before to continue
- data_plan_path: data plan path if you desire to include test data
- orgdefault_config: set defaut username and/or org wide email in metadata such as workflow based on target scratch org

  ```shell
  sfdx dxb:org:create -u orgname -s -p
  ```

### Profile

In the early days of DX and up to now, the team had a lot of struggle dealing with profile and permission sets as many things keep getting reorder alphabetically when new objects/fields/app/etc get created. Also due to the size of those XML files it make it hard for a lead developer to make proper effective code review.

So to remove this pain, I thought to decompose profiles in the same way salesforce did for object source folders. The command create a folder for each profile. Each profile folder will contains the definition of the profile and system permissions, then one folder for each object that will contains object crud, fls accessibility, record type assignments etc.

There is different way of working with this, but an example would be the follwoing. As a developer you would source:pull as per normal from your scratch org then you would run the command to decompose profile into tiny json files. You would then commit all your json files to your repo, and create your pull request to lead developer. As a lead developer it make easier to perform code review as each file is a single file.

Of course from this point, deployment doesn't understand this format, so you would have your deployment tool that would regroup all the json file into our original metadata file by running the reverse command. In this scenario a few things to consider is you will need to respectively gitignore the profile.xm files and you would need to forceignore the profile json files. Also as you can guess it's a lot of files. I am planning to extend my command in a way only the files that have changed will be include during the recomposition.

Another way of doing is developers simply use the commands locally and decompose/recompose before to commit but you lose the advantage of single file during pull request review I think.

- Convert & Build a single profile

  ```shell
  sfdx dxb:profile:build -p Admin -r force-app/main/default/profiles
  sfdx dxb:profile:convert -p Admin -r src/profiles
  ```

- Convert & Build all profile
  ```shell
  sfdx dxb:profile:build -r src/profiles
  sfdx dxb:profile:convert -r src/profiles
  ```

### User Access Check

Many times when you use a lot of permission sets you might struggle to find why a user has access to an object or a field. So I create a command where you pass the username, object name and/or field name and it will tell you in what profiles or permissions sets it's referenced.

```shell
sfdx dxb:user:access:why -o Product2
sfdx dxb:user:access:why -o Product2 -f External_ID__c
sfdx dxb:user:access:why -o Product2 -f External_ID__c -i johndoe@abc.com.au
```

### Clean your permission sets

In regards to permission set, if you want to remove access of a specific objetcs, fields, ... you simply need to remove the whole tags from the permissiom, you do not need to set the access to false. In many organisation, I see people doing prod sync, which increase the size of the perm set metadata files, because salesforce api will fetch everything that is included in the `mdapi:retrieve`. This doesn't seem to be the case for profiles though, you must explicitly mark something as false.

The idea of this command is to delete those unnecessary false access from files and keep your permission set clean.

```shell
sfdx dxb:permissionset:clean -f force-app/main/default/permissionsets/Social_Customer_Service_Permission_Set.permissionset-meta.xml
```

### Data Transfer (Export & Import)

Data transfer allows you to setup and automate transfer of data within your pipeline. This is very handy for sync reference data between your environment such as data driven solution (custom settings, reference objects, ...). You can either use "export and import" in the event you have a dedicated env as a source of truth for your all reference data. Or you can just use the import if you manage your export locally and push all your data into your repository. This command is using jsforce bulk api in order to handle large volume, and store the data in CSV file format which means it can go way beyond 2000 records per objects which is one of the limitation of the sfdx data plan and one of the reason I build this.

Important note, you will need 2 main things :

- Make sure all objects use a unique external id fields and that fields is always populated. This will required a trigger or PB on all objects. If you don't have a meaningful external id, you can set it by concatenating orgId_recordId.
- Create a data definition file as per below example.

#### Setup

You will need to create a data definition json file (data-def.json) anywhere in your DX project, usually in your data folder. For the export and import data folder, I usually create one folder for each target environment as you might have different set of data for different type of environment (DEV vs QA vs UAT vs SIT). With that being said, you might have more than one data definition jsonf file (data-def-qa.json, data-def-sit.json).

- active : only run the export/import if active = true
- objectName : api name of the standard/custom object
- filename: name of the CSV file to export or import
- fields: list of api name fields (comma separated). You can use cross reference field in order to upsert child to parent relationship. For Recordtype Id, simply use DeveloperName of your object record type and the command will fetch automatically the id of the record type in your target env.
- where: SOQL where clause to filter out certain records

```json
{
  "objects": [
    {
      "active": true,
      "objectName": "Parent_Object__c",
      "filename": "ABC_Parent_Objects.csv",
      "externalField": "External_ID__c",
      "fields": "Name,RecordType.DeveloperName,Status__c,External_ID__c",
      "where": "Status__c = 'Active'"
    },
    {
      "active": true,
      "objectName": "Child_Object__c",
      "filename": "ABC_Child_Objects.csv",
      "externalField": "External_ID__c",
      "fields": "Name,External_ID__c,Action__c,Completed__c,Parent_Object__r.External_ID__c",
      "where": ""
    }
  ]
}
```

#### Export

```shell
sfdx dxb:data:transfer:export -f data/data-def.json -d data/dev -u <sourceEnv>
```

#### Import

```shell
sfdx dxb:data:transfer:import -f data/data-def.json -d data/dev -u <targetEnv>
```

#### Azure Pipeline

How does it looks like in your yaml ? Reference data are usually store in your repo. But you could also decide to transfer from one dedicated env to another.

```yaml
- script: |
    sfdx dxb:data:transfer:export -f data/data-def.json -d data/dev -u <sourceEnv>
    sfdx dxb:data:transfer:import -f data/data-def.json -d data/dev -u <targetEnv>
  condition: succeeded()
  displayName: "DataLoad to targetEnv"
```

### Delta Deployment

The command generates a delta package based on changes in metadata files of a Salesforce project using git diff. The program uses the Salesforce CLI library and other third-party libraries such as source-deploy-retrieve.

The program defines a command called dxb:source:delta that accepts several options such as the type of changes to consider (commitid, tags, branch), the name of the branch, tag or commit ID, and the path of the output package. The command generates a delta package.xml that contains only the changed metadata files.

The program first reads the project configuration to determine the package directories and the Salesforce API version. Then, it executes a git diff command to get the changed files and their operation (added, modified, removed, or updated) based on the selected options. The program filters the changed files based on the provided filter, AMRU, which stands for Added, Modified, Removed, and Updated.

For each changed metadata file, the program determines its metadata type and adds it to the package.xml file. If the granularmode option is specified, the program includes only the changed components of the custom objects, and if not, it includes the whole custom object.

Finally, the program writes the generated package.xml file to the output directory.

```shell
sfdx dxb:source:delta -m tags -k mytag
sfdx dxb:source:delta -m branch -k origin/master -l RunSpecifiedTests
sfdx dxb:source:delta -m commitid -k 123456 -l RunSpecifiedTests -t objects,classes,workflows
```

The output of this command will give you the parameters in order to use the sfdx force:source:deploy command and perform the actual deployments.

```shell
-p force-app/main/default/classes/EmailMessageService.cls,force-app/main/default/classes/EmailMessageService.cls-meta.xml -r "EmailMessageServiceTest"
```

You can also get json output by adding --json into the command, it will give you something like the following :

```json
{
  "status": 0,
  "result": {
    "deltaMeta": [
      "force-app/main/default/classes/EmailMessageService.cls",
      "force-app/main/default/classes/EmailMessageService.cls-meta.xml"
    ],
    "testClasses": ["EmailMessageServiceTest"]
  }
}
```

The below will show you a coyple of example how to use this in your pipelines, assuming you have git checkout `develop` branch for example.

Azure Pipelines :

```yaml
- script: |
    delta=$(sfdx dxb:source:delta -m branch -k origin/master)
    testClass=$(sfdx dxb:source:fetchtest -p "$delta")
    sfdx force:source:deploy -p "$delta" -u targetEnv -l RunSpecifiedTests $testClass
  condition: succeeded()
  displayName: "Deploy to targetEnv"
```

Groovy pipeline

```groovy
def jsonSlurper = new JsonSlurper();
bat "sfdx dxb:source:delta -m branch -k origin/master --json -r > delta.json";
stdout = readFile("delta.json").trim();
def delta = jsonSlurper.parseText(stdout);
def options = "";
if (delta.testClasses != null && delta.testClasses.isEmpty() == false){
    options = "-l RunSpecifiedTest -r "+ delta.testClasses.join(',');
}
def cmd = "sfdx force:source:deploy -p "+delta.deltaMeta.join(',')+" -u prod -w 600 "+options;
bat cmd;
```

The challenge of this option is that if you delta is big, you might encounter long arguments list exception from your shell. Lately I've updated the delta to generate a proper package.xml.

```shell
sfdx dxb:source:delta -m branch -k origin/master -l RunSpecifiedTests -p delta_manifest
```

Sample output, delta_manifest/package.xml

```xml
<?xml version='1.0' encoding='UTF-8'?>
<Package xmlns='http://soap.sforce.com/2006/04/metadata'>
    <version>50.0</version>
    <types>
        <members>MyClass</members>
        <members>MyTestClass</members>
        <name>ApexClass</name>
    </types>
    <types>
        <members>Account</members>
        <members>Invoice__c</members>
        <name>CustomObject</name>
    </types>
</<Package>
```

You can now reference the generated xml in your sfdx deploy command

```shell
sfdx force:source:deploy -x delta_manifest/package.xml -u targetenv -g
```

or using the mdapi with src conversion and add your destructive change manifest into it.

```shell
sfdx force:source:convert -x delta_manifest/package.xml --outputdir mdapioutput
cp destructiveChanges/destructiveChanges.xml mdapioutput/
sfdx force:mdapi:deploy -u targetenv -l RunLocalTests w 600 -d mdapioutput -g
```

The fetch test command can also be adapted to read at the generated manifest.

```shell
sfdx dxb:source:fetchtest -x delta_manifest/package.xml > testCLasses
```

Sample Output

```shell
-r "MyTestClass"
```

I've been using this technique in a few project now and it has been quite good. Some other consideration is that your pipeline must be adapted if your delta doesn't contain metadata that depend on test classes in which case I check if my testClasses file contains something, if no then update TestLevel to NoTestRun.

```bash
if [[ "$TESTLEVEL" == "RunSpecifiedTests" ]]
then
  TESTCLASSES=$(<testClasses)
  if [ -s "testClasses" ]
  then
    echo "-    Test Classes: $TESTCLASSES"
  else
    TESTLEVEL="NoTestRun"
  fi
fi
```

### Schema Doc Gen

```shell
sfdx dxb:schema:doc:generate -c config/dxb-abc-docgen.json
sfdx dxb:schema:doc:generate -c config/dxb-abc-docgen.json -x manifest/abc-package.xml
```

This command generate as-build technical design pdf document by pulling metadata such as standard object, custom objects, apex classes, triggers etc directly from an org.

You will need to create a pdf document config json file as follow:
https://github.com/davidbrowaeys/DXB/blob/master/src/lib/documentinfo.json

List of standard objects is quite big so we only limit to what you need be defining <i>metadata.stdobjects</i>. For custom objects, currently it pull simply everything (except managed packages metadata).

The html template & stylesheet are included in DXB but you can add your own if required:
https://github.com/davidbrowaeys/DXB/blob/master/src/lib/schema-template.html
https://github.com/davidbrowaeys/DXB/blob/master/src/lib/bootstrap.min.css
