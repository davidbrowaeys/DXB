import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import * as permset from '../user/assignPermissionSet.js';


const exec = require('child_process').execSync;
const fs = require('fs');

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('nabx', 'org');

export default class Org extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx hello:org --targetusername myOrg@example.com --targetdevhubusername devhub@org.com
  Hello world! This is org: MyOrg and I will be around until Tue Mar 20 2018!
  My hub org id is: 00Dxx000000001234
  `,
  `$ sfdx hello:org --name myname --targetusername myOrg@example.com
  Hello myname! This is org: MyOrg and I will be around until Tue Mar 20 2018!
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    orgname :flags.string({char: 'u',description: 'alias of scratch org'}),
    includepackages :flags.boolean({char: 'p',description: 'include packages from cli config file'}),
    defaultorg: flags.boolean({char: 's', description: 'mark as default org'}),
    durationday : flags.number({char: 'd', description: 'duration of the scratch org (in days) (default:30, min:1, max:30)'}),
    includedata : flags.boolean({char: 'f',description: 'indicate if nab data need to be imported'}),
    includetrackinghistory: flags.boolean({char: 't', description: 'remove field tracking history tag from Account, Contact, Lead'})
  };
  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  async create_scratch_org(orgname: string, defaultorg:string, durationdays:number){
    this.ux.log(`sfdx force:org:create -f config/project-scratch-def.json -a ${orgname} ${defaultorg} -d \"${durationdays}\"`);
    this.ux.log(exec(`sfdx force:org:create -f config/project-scratch-def.json -a ${orgname} ${defaultorg} -d \"${durationdays}\"`).toString());
  }

  async deploy_legacy_packages(orgname: string, legacy_packages ,type: string){
    this.ux.log(`Installing your ${type} legacy packages...`);
    legacy_packages.forEach(function(elem) {
      try{
        this.ux.log(elem);
        exec(`sfdx force:mdapi:deploy --deploydir config/legacy-packages/${type}/${elem} -u ${orgname} -w 60 > output.txt`);
      }catch(err){
        throw new SfdxError(`Couldn't install ${elem}`);
      }
    });
  }

  async prompt_user_manual_config(orgname, manual_steps){
    this.ux.log('Due to some limitations with DX scratch org, you must enable manually the following feature(s) before to proceed:');
    manual_steps.forEach(function(elem) {
      console.log(elem);
    });
    this.ux.log(exec(`sfdx force:org:open -u ${orgname} -p /lightning/setup/ObjectManager/Account/FieldsAndRelationships/setHistoryTracking`).toString());
  
    var stdin = require('readline-sync');
    while(true) {
      var yn = stdin.question("Would you like to continue?(Y/N)");
      if(yn.toLowerCase() === 'y' ) {
        break;
      } else {
        process.exit();
      }
    }
  }

  async manuallyEnableTerritoryManagement(orgname) {
    console.log('Due to some limitations with scratch orgs in DX, you must manually enable Territory Management:');
  
    console.log(exec(`sfdx force:org:open -u ${orgname} -p /lightning/setup/Territory2Settings/home`).toString());
    var stdin = require('readline-sync');
    while(true) {
      var yn = stdin.question("Would you like to continue?(Y/N)");
      if(yn.toLowerCase() === 'y' ) {
        break;
      } else {
        process.exit();
      }
    }
  }
  
  async includetrackinghistory(disableFeedTrackingObjects){
    disableFeedTrackingObjects.forEach(function(elem) {
      console.log(`Disabling Feed Tracking History for ${elem}`);
      this.removeFeedTrackingHistoryInObject(elem);
    });
  }
  
  async removeFeedTrackingHistoryInObject(objectName){
    var objectPath = `./force-app/main/default/objects/${objectName}/${objectName}.object-meta.xml`;
    var content = fs.readFileSync(objectPath).toString();
    content = content.replace(new RegExp(`<enableHistory>.+</enableHistory>`,'g'), '<enableHistory>false</enableHistory>');
    fs.writeFileSync(objectPath, content);
  
    this.removeFeedTrackingHistoryInField(objectName);
  }
  
  async removeFeedTrackingHistoryInField(objectName){
    var objectPath = `./force-app/main/default/objects/${objectName}/fields`;
    fs.readdirSync(objectPath).forEach(file => {
      var content = fs.readFileSync(objectPath+'/'+file).toString();
      content = content.replace(new RegExp(`<trackHistory>.+</trackHistory>`,'g'), '');
      fs.writeFileSync(objectPath+'/'+file, content);
      });
  }

  async push_source(orgname){
    this.ux.log('Push source to org...'); 
    await exec(`sfdx force:source:push -g -f -u ${orgname} > output.txt`);
  }

  async install_packages(orgname, packages){
    console.log('Installing your (un)managed packages...');
    packages.forEach(function(elem) {
      console.log(`sfdx force:package:install --package ${elem} -u ${orgname} --json`);
      console.log(exec(`sfdx force:package:install --package ${elem} -u ${orgname} -w 60`).toString());
    });
  }

  async create_user(orgname, user_alias_prefix,user_def_file){
    const suffix = Math.floor((Math.random() * 20000000) + 1);
    if (!user_alias_prefix) user_alias_prefix = 'usr';
    await exec(`sfdx force:user:create --setalias ${user_alias_prefix}-${orgname} --definitionfile ${user_def_file} username=user.${suffix}@nab-test.${orgname} -u ${orgname} > output.txt`);
  }

  public async run() {
    let config = JSON.parse(fs.readFileSync('./config/nab-cli-def.json').toString());

    let orgname = this.flags.orgname;
    let defaultorg = this.flags.defaultorg ? '-s' : '';
    let durationdays = this.flags.durationdays || config.defaultdurationdays;   
    this.ux.log('\x1b[91m%s\x1b[0m', `Welcome to NAB DX! We are now creating your scratch org[${orgname}]...`);

    this.create_scratch_org(orgname, defaultorg, durationdays);

    //UPDATE WORKFLOWS
    console.log(exec(`sfdx nabx:org:setdefault -u ${orgname}`).toString());
    
    //DEPLOY PRE LEGACY PACKAGES
    if (config.pre_legacy_packages) {
      this.deploy_legacy_packages(orgname, config.pre_legacy_packages, 'pre');
    }

    //assign einstein permissionset
    console.log(exec(`sfdx nabx:user:assignPermissionSet -u ${orgname} -p EinsteinAnalyticsAdmin`).toString());
    
    //REMOVE FIELDS TRACKING HISTORY
    if (this.flags.includetrackinghistory) {
      this.includetrackinghistory(config.disableFeedTrackingHistory);
    } else if (config.manual_config_required){
      //STOP USER FOR MANUAL CONFIG
      this.prompt_user_manual_config(orgname, config.manual_steps);
    }

    //ENABLE TERRITORY MANAGEMENT
		this.manuallyEnableTerritoryManagement(orgname); 

    //INSTALL PACKAGES
    if (this.flags.includepackages && config.packages) {
      this.install_packages(orgname, config.packages);
    }
			
    //PUSH DX SOURCE
    this.push_source(orgname);
			
    //DEPLOY POST LEGACY PACKAGES
    if (config.post_legacy_packages) {
      this.deploy_legacy_packages(orgname, config.post_legacy_packages, 'post');
    }
    //create other user, this also fix FLS being deleted from profile
    if (config.user_def_file){
      this.create_user(orgname, config.user_alias_prefix, config.user_def_file);
    }
    this.ux.log(exec(`sfdx force:org:display -u ${orgname}`).toString());
    this.ux.log('\x1b[91m%s\x1b[0m', `Thank you for your patience! You can now enjoy your scrath org. Happy coding!`);
  }
}
