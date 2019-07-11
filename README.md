# DeloitteForce-CLI

A cli plugin for the Salesforce CLI built by David Browaeys containing a lot of helpful commands. 

## Pre-requisite
1. Install [SDFX CLI](https://developer.salesforce.com/tools/sfdxcli) 

2. Install [node.js. + npm](https://nodejs.org/en/). 
Once installed, checkout proxy setting if you are behind corporate proxy.

## Proxy Settings
If you are behind firewall and corporate proxy. Please follow those instructions. 
1. Open terminal

    ```shell
    npm config set https-proxy http://address:port
    npm config set proxy http://address:port
    npm config set sslVerify false
    npm config set strict-ssl false
    ```

## Install DeloitteForce-CLI

1. go to your local workspace and clone DeloitteForce-CLI repository:

    ```shell
    git clone https://github.com/davidbrowaeys/DeloitteForce-CLI.git
    ``` 

2. Go to DeloitteForce-CLI folder and install it globally using npm: 

    ```shell
    cd DeloitteForce-CLI
    sudo npm install -g .
    ```

## Initialize force
Some of the commands required some configuration. So in order to fully utilize DeloitteForce-CLI, you must run the following command. This will update sfdx-project.json and set DeloitteForce-CLI definition json.
  ```shell
  deloitte force:install
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
      "deloitteforce": {
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
    deloitte force:apex        A set of commands that allow to manilpulate apex.
    deloitte force:community   Publish community(network) using connect api.
    deloitte force:data        A set of commands that allows to manipulate and optimize data.
    deloitte force:delta       A set of commands that generate delta package for faster deployment.
    deloitte force:mdapi       A set of commands that extends dx mdapi topic.
    deloitte force:object      A set of commands in regards to salesforce objects.
    deloitte force:org         A set of commands for scratch org and sandbox
    deloitte force:permission  Create fieldset for specified object and push to scratch org.
    deloitte force:profile     A set of commands that allow to manipuilate and faciliate salesforce profiles.
    deloitte force:static      A set of commands regarding static resource
    deloitte force:user        set defaut username and org wide email in metadata such as workflow based on target scratch org
  ```

## Popular Commands

### Delta Deployment

  ```shell
  deloitte force:source:delta -r delta -m tags -p mytag
  deloitte force:source:delta -r delta -m commitid -k 123456
  deloitte force:source:delta -r delta -m branch -k origin/master
  ```
Here is an example of how to use the deloitte delta command in a pipeline JenkinsFile
  ```groovy
  def jsonSlurper = new JsonSlurper();
  bat "deloitte force:source:delta -m branch -k master --json -r > delta.json";
  stdout = readFile("delta.json").trim();
  def delta = jsonSlurper.parseText(stdout);
  def options = "";
  if (delta.testClasses != null && delta.testClasses.isEmpty() == false){
      options = "-l RunSpecifiedTest -r "+ delta.testClasses.join(',');
  }
  def cmd = "sfdx force:source:deploy -p "+delta.deltaMeta.join(',')+" -u prod -w 600 "+options;
  bat cmd;
  ```
