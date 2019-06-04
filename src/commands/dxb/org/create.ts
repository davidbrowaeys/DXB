import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import * as permset from '../user/assignPermissionSet.js';


const exec = require('child_process').execSync;
const execAsync = require('child_process').exec;
const fs = require('fs');

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('nabx', 'org');

export default class Org extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx dxb:org:create -u myorg -p -s`
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
    try{
      return new Promise(function (resolve, reject) {
          execAsync(`sfdx force:org:create -f config/project-scratch-def.json -a ${orgname} ${defaultorg} -d \"${durationdays}\"`, (error, stdout, stderr) => {
            if (error) {
              console.warn(error);
            }
            resolve(stdout? stdout : stderr);
          });
      });
    }catch(err){
      throw new SfdxError('Unable to create scratch org!');
    }
  }

  async deploy_legacy_packages(orgname: string, legacy_packages ,type: string){
    this.ux.log(`Installing your ${type} legacy packages...`);
    try{
      legacy_packages.forEach( elem => {
        exec(`sfdx force:mdapi:deploy --deploydir config/legacy-packages/${type}/${elem} -u ${orgname} -w 60`).toString();
      });
    }catch(err){
      throw new SfdxError(`Unable to install your ${type} legacy packages!`);
    }
  }

  async prompt_user_manual_config(orgname, manual_steps){
    this.ux.log('Due to some limitations with DX scratch org, you must enable manually the following feature(s) before to proceed:');
    manual_steps.forEach(function(elem) {
      console.log(elem);
    });
    this.ux.log(exec(`sfdx force:org:open -u ${orgname} -p /lightning/setup/SetupOneHome/home`).toString());
  
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
    try{
      return new Promise(async function (resolve, reject) {
          await execAsync(`sfdx force:source:push -g -f -u ${orgname}`, (error, stdout, stderr) => {
            if (error) {
              console.warn(error);
            }
            resolve(stdout? stdout : stderr);
          });
      });
    }catch(err){
      throw new SfdxError('Unable to push source to scratch org!');
    }
  }

  async install_packages(orgname, packages){
    console.log('Installing your (un)managed packages...');
    packages.forEach(elem =>{
      try{
        var output = JSON.parse(exec(`sfdx force:package:install --package ${elem} -u ${orgname} -w 60 --json -r`).toString());
        if (output && output.result && output.result.Status === 'SUCCESS'){
          console.log(`Successfully installed package [${elem}]`);
        }else{
          throw new SfdxError(`Error while installing package [${elem}]`);
        }
      }catch(err){
        throw new SfdxError('Unable to install (un)managed packages!');
      }
    });
  }

  async create_user(orgname, user_alias_prefix,user_def_file){
    const suffix = Math.floor((Math.random() * 20000000) + 1);
    if (!user_alias_prefix) user_alias_prefix = 'usr';
    try{
      return new Promise(function (resolve, reject) {
          execAsync(`sfdx force:user:create --setalias ${user_alias_prefix}-${orgname} --definitionfile ${user_def_file} username=user.${suffix}@nab-test.${orgname} -u ${orgname}`, (error, stdout, stderr) => {
            if (error) {
              console.warn(error);
            }
            resolve(stdout? stdout : stderr);
          });
      });
    }catch(err){
      throw new SfdxError('Unable to create user to scratch org!');
    }
  }

  public async run() {
    let config = JSON.parse(fs.readFileSync('./config/nab-cli-def.json').toString());

    let orgname = this.flags.orgname;
    let defaultorg = this.flags.defaultorg ? '-s' : '';
    let durationdays = this.flags.durationdays || config.defaultdurationdays;   
    this.ux.log('\x1b[91m%s\x1b[0m', `Welcome to NAB DX! We are now creating your scratch org[${orgname}]...`);

    var output = await this.create_scratch_org(orgname, defaultorg, durationdays);
    console.log(output);

    //UPDATE WORKFLOWS
    console.log(exec(`sfdx nabx:org:setdefault -u ${orgname}`).toString());
    
    //DEPLOY PRE LEGACY PACKAGES
    if (config.pre_legacy_packages) {
      await this.deploy_legacy_packages(orgname, config.pre_legacy_packages, 'pre');
    }

    //assign einstein permissionset
    console.log(exec(`sfdx nabx:user:assignPermissionSet -u ${orgname} -p EinsteinAnalyticsAdmin`).toString());
    
    //REMOVE FIELDS TRACKING HISTORY
    if (this.flags.includetrackinghistory) {
      this.includetrackinghistory(config.disableFeedTrackingHistory);
    } 
    
    if (config.manual_config_required){
      //STOP USER FOR MANUAL CONFIG
      this.prompt_user_manual_config(orgname, config.manual_steps);
    }

    //INSTALL PACKAGES
    if (this.flags.includepackages && config.packages) {
      await this.install_packages(orgname, config.packages);
    }
			
    //PUSH DX SOURCE
    output = await this.push_source(orgname);
    console.log(output);
			
    //DEPLOY POST LEGACY PACKAGES
    if (config.post_legacy_packages) {
      await this.deploy_legacy_packages(orgname, config.post_legacy_packages, 'post');
    }
    //create other user, this also fix FLS being deleted from profile
    if (config.user_def_file){
      output = await this.create_user(orgname, config.user_alias_prefix, config.user_def_file);
      console.log(output);
    }
    this.ux.log(exec(`sfdx force:org:display -u ${orgname}`).toString());
    this.ux.log('\x1b[91m%s\x1b[0m', `Thank you for your patience! You can now enjoy your scrath org. Happy coding!`);
  }
}