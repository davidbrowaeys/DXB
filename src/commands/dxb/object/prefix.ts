
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';

const exec = require('child_process').execSync;

function retrievesobjectfields(orgname, sobject){
    console.log(`Retrieving ${sobject} schema...`); 
    orgname = orgname ? ('-u '+ orgname) : '';
    return exec(`sfdx force:schema:sobject:describe -s ${sobject} ${orgname} --json`).toString();
}

export default class SObjectPrefix extends SfdxCommand {

    public static description = 'Retrieve key prefix of specified sobject.';
  
    public static examples = [
    `$ sfdx dxb:object:prefix -o Account
    Retrieving Account schema...
    ==== Object Prefix:      001
    `
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        objectname: flags.string({char:'o',description:'Name of custom object',required:true})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;
  
    public async run() {
        let orgname = this.org.getUsername();
        let sobject = this.flags.objectname;
        
        try{
            var objectschema = retrievesobjectfields(orgname,sobject);
            objectschema = JSON.parse(objectschema).result.keyPrefix;
            this.ux.log('==== Object Prefix:    ',objectschema);
        }catch(err){
            this.ux.error(err);
        }
    }
}
