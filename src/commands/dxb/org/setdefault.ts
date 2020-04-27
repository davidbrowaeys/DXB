import { SfdxCommand } from '@salesforce/command';
const path = require('path');
const fs = require('fs');

function update_workflows(dirfile,username){
	let content = fs.readFileSync(dirfile).toString();
	content = content.replace(new RegExp(`<lookupValue>.+</lookupValue>(\s+|)`,'g'), '<lookupValue>'+username+'</lookupValue>');
	content = content.replace(new RegExp(`<senderType>.+</senderType>(\s+|)`,'g'), '<senderType>CurrentUser</senderType>');
	fs.writeFileSync(dirfile, content);
}
function update_emailservice(dirfile,username){
	let content = fs.readFileSync(dirfile).toString();
	content = content.replace(new RegExp(`<runAsUser>.+</runAsUser>(\s+|)`,'g'), '<runAsUser>'+username+'</runAsUser>');
	fs.writeFileSync(dirfile, content);
}
function update_autoresponserule(dirfile,username){
	let content = fs.readFileSync(dirfile).toString();
	content = content.replace(new RegExp(`<senderEmail>.+</senderEmail>(\s+|)`,'g'), '<senderEmail>'+username+'</senderEmail>');
	content = content.replace(new RegExp(`<replyToEmail>.+</replyToEmail>(\s+|)`,'g'), '<replyToEmail>'+username+'</replyToEmail>');
	fs.writeFileSync(dirfile, content);
}
function update_dashboards(dirfile){	
	let content = fs.readFileSync(dirfile).toString();
	content = content.replace(new RegExp(`<dashboardType>LoggedInUser</dashboardType>`,'g'), '<dashboardType>SpecifiedUser</dashboardType>');
	fs.writeFileSync(dirfile, content);
}
export default class MetadataReset extends SfdxCommand {

  public static description = 'set defaut username and org wide email in metadata such as workflow based on target scratch org';

  public static examples = [
  `$ sfdx dxb:org:setdefault --targetusername myOrg@example.com`
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {};
  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public async run() {
		let orgname = this.org.getUsername();
		this.ux.log('Replacing unspported metadata within workflow(s), i.e.: field update on specific user, send email from org wide email...');
		var dirpath = './force-app/main/default/workflows';
		if (fs.existsSync(dirpath)){
			console.log('Processing workflows :');
			fs.readdirSync(dirpath).forEach(file => {
				console.log(`>    ${file}...`);
				update_workflows(dirpath+'/'+file,orgname);
			});
		}

		dirpath = './force-app/main/default/emailservices';
		if (fs.existsSync(dirpath)){
			console.log('Processing emailservices :');
			fs.readdirSync(dirpath).forEach(file => {
				console.log(`>    ${file}...`);
				update_emailservice(dirpath+'/'+file,orgname);
			});
		}

		dirpath = './force-app/main/default/autoResponseRules';
		if (fs.existsSync(dirpath)){
			console.log('Processing autoResponseRules :');
			fs.readdirSync(dirpath).forEach(file => {
				console.log(`>    ${file}...`);
				update_autoresponserule(dirpath+'/'+file,orgname);
			});
		}

		dirpath = './force-app/main/default/dashboards';
			if (fs.existsSync(dirpath)){
				fs.readdirSync(dirpath).forEach( ( dir:string ) => {
					fs.readdirSync(path.join(dirpath,dir)).forEach( ( file:string ) => {
						console.log(`Updating ${file}...`);
						update_dashboards(path.join(dirpath,dir,file));
					});
				});
			}
  }
}
