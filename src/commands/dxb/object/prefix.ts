
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';

const exec = require('child_process').execSync;
const request = require('request');

function retrievesobjectfields(orgname, sobject){
    console.log(`Retrieving ${sobject} schema...`); 
    orgname = orgname ? ('-u '+ orgname) : '';
    return exec(`sfdx force:schema:sobject:describe -s ${sobject} ${orgname} --json`).toString();
}

async function retrievesglobalschema(accessToken, instanceUrl){
    console.log(`Retrieving global schema...`); 
    try{
        return new Promise(async function (resolve, reject) {
            const options = {
                method  : 'GET',
                headers : {
                            'Authorization' : 'Bearer ' + accessToken,
                            'X-SFDC-Session' : accessToken
                            },
                url     : instanceUrl+'/services/data/v45.0/sobjects/',
                json: true,
            };
            await request(options, function (error, response, body) {
                if (error || response.statusCode !== 200){
                    throw new SfdxError(error ? error : response.statusMessage);
                }
                resolve(body.sobjects);
            });
        });
    }catch(err){
    throw new SfdxError('Unable to push source to scratch org!');
    }
}

export default class SObjectPrefix extends SfdxCommand {

    public static description = 'Retrieve key prefix of specified sobject.';
  
    public static examples = [
    `$ sfdx dxb:object:prefix -o Account
    Retrieving Account schema...
    ==== Object Prefix:      001
    `,
    `$ sfdx dxb:object:prefix -p 001
    Retrieving Account schema...
    ==== Object Name:      Account
    `,
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        objectname: flags.string({char:'o',description:'Name of custom object'}),
        prefix: flags.string({char:'p', description: 'prefix of the object'})
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
        let prefix = this.flags.prefix;
        
        try{
            if (sobject){
                var objectschema = retrievesobjectfields(orgname,sobject);
                objectschema = JSON.parse(objectschema).result.keyPrefix;
                this.ux.log('==== Object Prefix:    ',objectschema);
            } else if (prefix){
                let accessToken = this.org.getConnection().accessToken;
                let instanceUrl = this.org.getConnection().instanceUrl;

                if (!accessToken || !instanceUrl){
                    throw new SfdxError(`Connection not valid.`);
                }
        
                this.ux.log('Connected to ',instanceUrl);

                var objectName;
                var globalschema = await retrievesglobalschema(accessToken,instanceUrl);
                
                for ( var i in globalschema){
                    var elem = globalschema[i];
                    if (elem.keyPrefix === prefix){
                        objectName = elem.name;
                        break;
                    }
                }
                if (objectName){
                    this.ux.log('==== Object Name:    ',objectName);
                }else{
                    this.ux.error('Prefix not found.');
                }
            }
        }catch(err){
            this.ux.error(err);
        }
    }
}
