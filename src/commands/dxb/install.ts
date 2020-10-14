
import { SfdxCommand } from '@salesforce/command';

const fs = require('fs');

export default class ProjectSetup extends SfdxCommand {

  public static description = 'This command initialize your sfdx project to supoport DXB cli. ';

  public static examples = [
  `$ sfdx dxb:install`
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
      this.ux.startSpinner('Setting up your project');
      var init = {
            "defaultdurationdays" : "30",
            "packages" : [],
            "pre_legacy_packages" : [],
            "userPermissionsKnowledgeUser" : false,
            "deferPermissionSet": null,
            "deferSharingUser": null,
            "disableFeedTrackingHistory":[],
            "manual_config_required" :  false,
            "manual_config_start_url" : "/ltng/switcher?destination=classic&referrer=%2Flightning%2Fsetup%2FSetupOneHome%2Fhome",
            "manual_steps" : [
                "- Sample: Chatter Settings > Enable Unlisted Groups"
            ],
            "data_plan_path" : "./data/sample/data-plan.json",
            "apextemplatepath" : null,
            "orgdefault_config" : [
              {
                "folder" : "workflows",
                "rules" : [{
                    "regex" : "<lookupValue>.+</lookupValue>",
                    "replaceby" : '<lookupValue>{{mergevalue}}</lookupValue>',
                    "mergefield" : "username"
                  },{
                    "regex" : "<senderType>.+</senderType>",
                    "replaceby" : '<senderType>CurrentUser</senderType>'
                }]
              },
              {
                "folder" : "emailservices",
                "rules" : [{
                    "regex" : "<runAsUser>.+</runAsUser>",
                    "replaceby" : '<runAsUser>{{mergevalue}}</runAsUser>',
                    "mergefield" : "username"
                }]
              },
              {
                "folder" : "autoResponseRules",
                "rules" : [{
                    "regex" : "<senderEmail>.+</senderEmail>",
                    "replaceby" : '<senderEmail>{{mergevalue}}</senderEmail>',
                    "mergefield" : "username"
                  },{
                    "regex" : "<senderEmail>.+</senderEmail>",
                    "replaceby" : '<senderEmail>{{mergevalue}}</senderEmail>',
                    "mergefield" : "username"
                }]
              },
              {
                "folder" : "dashboards",
                "rules" : [{
                    "regex" : "<dashboardType>LoggedInUser</dashboardType>",
                    "replaceby" : '<dashboardType>SpecifiedUser</dashboardType>'
                }]
              },
              {
                "folder" : "approvalProcesses",
                "rules" : [{
                    "regex" : "<name>.+</name><!--username-->",
                    "replaceby" : '<name>{{mergevalue}}</name>',
                    "mergefield" : "username"
                }]
              }
            ]
        }

        let config = JSON.parse(fs.readFileSync('sfdx-project.json').toString());
        if (!config.plugins) config["plugins"] = {};
        config["plugins"]["dxb"] = init;
        fs.writeFileSync('sfdx-project.json', JSON.stringify(config, null, 2));
        this.ux.stopSpinner(`\n\nProject setup completed successfully. Welcome to DXB CLI 1.0!`);
        return {init};
  }
}