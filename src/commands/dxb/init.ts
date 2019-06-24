
import { SfdxCommand } from '@salesforce/command';

const fs = require('fs');

export default class DXBInit extends SfdxCommand {

  public static description = 'This command initialize your project for dxb.';

  public static examples = [
  `$ sfdx dxb:init`
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {};
  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run() {
      var init = {
            "defaultdurationdays" : "30",
            "packages" : [],
            "pre_legacy_packages" : [],
            "disableFeedTrackingHistory":[],
            "manual_config_required" :  false,
            "manual_config_start_url" : "/ltng/switcher?destination=classic&referrer=%2Flightning%2Fsetup%2FSetupOneHome%2Fhome",
            "manual_steps" : [
                "- Sample: Chatter Settings > Enable Unlisted Groups"
            ],
            "data_plan_path" : "./data/sample/data-plan.json",
            "apextemplatepath" : null
        }

        let config = JSON.parse(fs.readFileSync('sfdx-project.json').toString());
        if (!config.plugins) config["plugins"] = {};
        config["plugins"]["dxb"] = init;
        fs.writeFileSync('sfdx-project.json', JSON.stringify(config, null, 2));
  }
}