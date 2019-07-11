import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';

const exec = require('child_process').execSync;
const path = require('path');
const fs = require('fs');

function displayOutput(){
	var output = fs.readFileSync('./output.txt');
	console.log(output.toString());
}
function update_workflows(dirfile,username){
	let content = fs.readFileSync(dirfile).toString();
	content = content.replace(new RegExp(`<lookupValue>.+</lookupValue>(\s+|)<!--username-->`,'g'), '<lookupValue>'+username+'</lookupValue><!--username-->');
	content = content.replace(new RegExp(`<senderType>.+</senderType>(\s+|)<!--orgwideemail-->`,'g'), '<senderType>CurrentUser</senderType><!--orgwideemail-->');
	fs.writeFileSync(dirfile, content);
}

function update_dashboards(dirfile){
	let content = fs.readFileSync(dirfile).toString();
	content = content.replace(new RegExp(`<dashboardType>LoggedInUser</dashboardType>`,'g'), '<dashboardType>SpecifiedUser</dashboardType>');
	fs.writeFileSync(dirfile, content);
}

function delete_emails(username){
	exec(`sfdx force:data:soql:query -u ${username} -q "select id, Name from EmailTemplate WHERE UIType='SFX'" -r csv > emailtemplates.csv`);
	exec(`sfdx force:data:bulk:delete -u ${username} -w 99 -s EmailTemplate -f emailtemplates.csv`);
	fs.unlinkSync('emailtemplates.csv');
}

export default class MetadataReset extends SfdxCommand {

  public static description = 'set defaut username and org wide email in metadata such as workflow based on target scratch org';

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

  protected static flagsConfig = {};
  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run() {
      let orgname = this.org.getUsername();
			this.ux.log('Replacing unspported metadata within workflow(s), i.e.: field update on specific user, send email from org wide email...');
			var orginfo = JSON.parse(exec(`sfdx force:org:display -u ${orgname} --json`).toString());
			var currentuser = orginfo.result.username;
			var dirpath = './force-app/main/default/workflows';
			if (fs.existsSync(dirpath)){
				fs.readdirSync(dirpath).forEach(file => {
					console.log(`Updating ${file}...`);
					update_workflows(dirpath+'/'+file,currentuser);
				});
			}
			
			dirpath = './force-app/main/default/dashboards/NAB_Dashboards';
			if (fs.existsSync(dirpath)){
				fs.readdirSync(dirpath).forEach(file => {
					console.log(`Updating ${file}...`);
					update_dashboards(dirpath+'/'+file);
				});
			}
  }
}
