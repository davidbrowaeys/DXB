import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';

const exec = require('child_process').execSync;

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('nabx', 'org');

export default class AssignPermission extends SfdxCommand {

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

	protected static flagsConfig = {
    permissionsetname :flags.string({char: 'p',description: 'permission set name to assign'})
  };
  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
	protected static requiresProject = false;
	
	assignPermission (orgname,permissionSetName){            
		this.ux.log('Assigning Permissionset');
		this.ux.log(`sfdx force:user:permset:assign -n ${permissionSetName} -u ${orgname} --json`);
		let output = exec(`sfdx force:user:permset:assign -n ${permissionSetName} -u ${orgname} --json`);
		if(output){
				this.ux.log(output.toString());
		}	
	}
  public async run() {
		let orgname = this.org.getUsername();
		let permissionSetName = this.flags.permissionSetName;
		if (orgname && permissionSetName){
				this.assignPermission(orgname,permissionSetName);
		}    
  }
}
