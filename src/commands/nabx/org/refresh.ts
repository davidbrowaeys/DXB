import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';

const exec = require('child_process').execSync;
const execAsync = require('child_process').exec;
const path = require('path');
const fs = require('fs');

function remove_dir(path) {
	if (fs.existsSync(path)) {
		fs.readdirSync(path).forEach(function (file, index) {
			var curPath = path + "/" + file;
			if (fs.lstatSync(curPath).isDirectory()) { // recurse
				remove_dir(curPath);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
}

function refresh_meta(username) {
	console.log(exec(`sfdx nabx:org:setdefault -u ${username}`).toString());
	push_source(username);
}

async function push_source(orgname){
    console.log('Push source to org...'); 
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

export default class OrgRefresh extends SfdxCommand {

    public static description = 'Refresh scratch org by deleting local sync file, reset some metadata by target username, and re-push all to scratch org.';
  
    public static examples = [
    `$ sfdx nabx:org:refresh --targetusername myOrg@example.com`
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {};
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = true;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;
  
    public async run() {
        var username = this.org.getUsername();
        //REFRESH SOURCE
        refresh_meta(username);
    }
}