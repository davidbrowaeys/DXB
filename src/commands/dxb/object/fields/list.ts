
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';

const exec = require('child_process').execSync;

function retrievesobjectfields(orgname, sobject){
    console.log(`Retrieving ${sobject} fields from schema...`); 
    orgname = orgname ? ('-u '+ orgname) : '';
    return exec(`sfdx force:schema:sobject:describe -s ${sobject} ${orgname} --json`).toString();
}

export default class FieldList extends SfdxCommand {

    public static description = 'Retrieve list of fields of specified object.';
  
    public static examples = [
    `$ sfdx dxb:object:fields:list --targetusername myOrg@example.com --objectname Account`
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        objectname: flags.string({char:'o',description:'Name of custom object'})
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

        if (!sobject){
            throw new SfdxError('Must pass a orgname in order to use this command!');
        }

        try{
            var objectschema = retrievesobjectfields(orgname,sobject);
            objectschema = JSON.parse(objectschema).result.fields;

            var Table = require('tty-table');
            var chalk = require('chalk');

            var rows = [];
            for (var i = 0; i < objectschema.length; i=i+4){
                rows.push([
                    objectschema[i]   ? objectschema[i].name   + '(' + objectschema[i].type   + ')' : '',
                    objectschema[i+1] ? objectschema[i+1].name + '(' + objectschema[i+1].type + ')' : '',
                    objectschema[i+2] ? objectschema[i+2].name + '(' + objectschema[i+2].type + ')' : '',
                    objectschema[i+3] ? objectschema[i+3].name + '(' + objectschema[i+3].type + ')' : ''
                ]);
            }
            var t1 = Table([],rows,null,{
                borderStyle : 1,
                borderColor : "blue",
                paddingBottom : 0,
                headerAlign : "center",
                align : "left",
                color : "white",
                truncate: "..."
            });
            console.log(t1.render());

            // if (objectschema.result.queryable){
            //     var fields = "Name";
            //     objectschema.result.fields.forEach(function(f){
            //         if(!f.deprecatedAndHidden && f.name !== 'Name') fields = fields +","+ f.name;
            //     });
            // }
            // console.log('\n=== Available Object Fields \n'+fields+'\n');
        }catch(err){
            console.log(err);
        }
    }
}
