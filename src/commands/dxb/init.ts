
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';

const path = require('path');
const fse = require('fs-extra');
const fs = require('fs');
const execAsync = require('child_process').exec;

var content = '<?xml version="1.0" encoding="UTF-8"?>'+
              '<StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">'+
              '<contentType>{{content_type}}</contentType>'+
              '<description>{{description}}</description>'+
              '</StaticResource>';

export default class DXBInit extends SfdxCommand {

  public static description = 'This command initialize your project for dxb.';

  public static examples = [
  `$ sfdx dxb:init`
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {};
  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run() {
      var init = {
          "plugins" : {
            "defaultdurationdays" : "30",
            "packages" : [],
            "pre_legacy_packages" : [],
            "disableFeedTrackingHistory":[],
            "manual_config_required" :  false,
            "manual_config_start_url" : "/ltng/switcher?destination=classic&referrer=%2Flightning%2Fsetup%2FSetupOneHome%2Fhome",
            "manual_steps" : [
                "- Sample: Chatter Settings > Enable Unlisted Groups"
            ],
            "data_plan_path" : "./data/sample/data-plan.json"
        }
    }
  }
}