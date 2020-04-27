# DXB-CLI

A cli plugin for the Salesforce CLI built by David Browaeys containing a lot of helpful commands. 

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
        "disableFeedTrackingHistory": [],
        "manual_config_required": false,
        "manual_config_start_url": "/ltng/switcher?destination=classic&referrer=%2Flightning%2Fsetup%2FSetupOneHome%2Fhome",
        "manual_steps": [
          "- Sample: Chatter Settings > Enable Unlisted Groups"
        ],
        "data_plan_path": "./data/sample/data-plan.json",
        "apextemplatepath": null
      }
    }
  }
  ```

## Topics
  ```shell
    sfdx dxb:apex        A set of commands that allow to manilpulate apex.
    sfdx dxb:community   Publish community(network) using connect api.
    sfdx dxb:data        A set of commands that allows to manipulate and optimize data.
    sfdx dxb:delta       A set of commands that generate delta package for faster deployment.
    sfdx dxb:mdapi       A set of commands that extends dx mdapi topic.
    sfdx dxb:object      A set of commands in regards to salesforce objects.
    sfdx dxb:org         A set of commands for scratch org and sandbox
    sfdx dxb:permission  Create fieldset for specified object and push to scratch org.
    sfdx dxb:profile     A set of commands that allow to manipuilate and faciliate salesforce profiles.
    sfdx dxb:static      A set of commands regarding static resource
    sfdx dxb:user        set defaut username and org wide email in metadata such as workflow based on target scratch org
  ```

### Create DXB Scratch Org 
Creating a scratch can be vey tidious and might required a lot of steps especially if you have managed package to install. The purpose of this command is to remove those long tasks into a single one. In order to use the command you must config dxb plugin within your sfdx-project.json file. 

* defaultdurationdays: override default duration to n days
* packages: list of managed package id
* manual_config_required: if true, prompt user to execute manual steps in scratch org. 
* manual_config_start_url: start URL when open scratch org for manual pre config
* manual_steps : list manual config to perform before to continue
* data_plan_path: data plan path if you desire to include test data
* orgdefault_config: set defaut username and/or org wide email in metadata such as workflow based on target scratch org

  ```shell
  sfdx dxb:org:create -u orgname -s -p
  ```

### Profile 

In the early days of DX and up to now, the team had a lot of struggle dealing with profile and permission sets as many things keep getting reorder alphabetically when new objects/fields/app/etc get created. Also due to the size of those XML files it make it hard for a lead developer to make proper effective code review. 

So to remove this pain, I thought to decompose profiles in the same way salesforce did for object source folders. The command create a folder for each profile. Each profile folder will contains the definition of the profile and system permissions, then one folder for each object that will contains object crud, fls accessibility, record type assignments etc. 

There is different way of working with this, but an example would be the follwoing. As a developer you would source:pull as per normal from your scratch org then you would run the command to decompose profile into tiny json files. You would then commit all your json files to your repo, and create your pull request to lead developer. As a lead developer it make easier to perform code review as each file is a single file. 

Of course from this point, deployment doesn't understand this format, so you would have your deployment tool that would regroup all the json file into our original metadata file by running the reverse command. In this scenario a few things to consider is you will need to respectively gitignore the profile.xm files and you would need to forceignore the profile json files. Also as you can guess it's a lot of files. I am planning to extend my command in a way only the files that have changed will be include during the recomposition. 

Another way of doing is developers simply use the commands locally and decompose/recompose before to commit but you lose the advantage of single file during pull request review I think. 

* Convert & Build a single profile
  ```shell
  sfdx dxb:profile:build -p Admin -o force-app/main/default/profiles
  sfdx dxb:profile:convert -p Admin -r src/profiles
  ```

* Convert & Build all profile
  ```shell
  sfdx dxb:profile:build -o src/profiles
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
In regards to permission set, if you want to remove access of a specific objetcs, fields, ... you simply need to remove the whole tags from the permissiom, you do not need to set the access to false. In many organisation, I see people doing prod sync, which increase the size of the perm set metadata files, because salesforce api will fetch everything that is included in the ```mdapi:retrieve```. This those seemns to be the case for profiles though. 

The idea of this command is to delete those unnecessary false access from files and keep your permission set clean. 
```shell
sfdx dxb:permissionset:clean -p Customer_Community_My_Application -r src/permissionsets
```