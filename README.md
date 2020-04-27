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
