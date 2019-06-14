
import { flags } from '@oclif/command';
import { SfdxCommand, core } from '@salesforce/command';

const exec = require('child_process').execSync;

export default class FieldSetCreate extends SfdxCommand {

    public static description = 'Create fieldset for specified object and push to scratch org.';
  
    public static examples = [
    `$ sfdx dxb:object:create --targetusername myOrg@example.com --objectname Invoice`
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
        this.ux.setSpinnerStatus('Progressing...');
        this.ux.startSpinner('Connecting to scratch org');
        let orgname = this.org.getUsername();
        this.ux.stopSpinner('Connected!');
        this.ux.setSpinnerStatus('Progressing...');
        this.ux.startSpinner('Retrieving user permissions');
        await retrieveSchema(orgname);
        this.ux.stopSpinner('Success!');
    }
}

async function retrieveSchema(orgname){
    var output = JSON.parse(exec('sfdx force:schema:sobject:describe -s PermissionSet '+(orgname ? '-u '+ orgname : '') +' --json').toString());
    var Table = require('cli-table');
    var table = new Table({
        head: ['Label', 'Name'], 
        colWidths: [100, 100]
    });
    
    console.log('List of all user permissions :');
    output.result.fields.forEach(element => {
        if (element.name.indexOf('Permissions') >= 0){
            table.push([
                element.label,
                element.name.replace('Permissions','')
              ]);
        }
    });
    console.log(table.toString());
}