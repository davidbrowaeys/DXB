
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';

const fs = require('fs');
const exec = require('child_process').exec;

var fieldlist = '';
var content =   '<?xml version="1.0" encoding="UTF-8"?>\n'+
                '<fieldSets xmlns="http://soap.sforce.com/2006/04/metadata">\n'+
                '   <fullName>{{fullname}}</fullName>\n'+
                '   <description>{{description}}</description>\n'+
                '{{fieldlist}}'+
                '   <label>{{label}}</label>\n'+
                '</fieldSets>';

function updateContent(varName, question) {
    var stdin = require('readline-sync');
    var res = stdin.question(question);
    
    content = content.replace(new RegExp(`{{${varName}}}`, 'g'), res);
}

async function push_source(orgname){
    console.log('Push source to org...'); 
    try{
      return new Promise(async function (resolve, reject) {
          await exec(`sfdx force:source:push -g -f -u ${orgname}`, (error, stdout, stderr) => {
            resolve(stdout? stdout : stderr);
          });
      });
    }catch(err){
      throw new SfdxError('Unable to push source to scratch org!');
    }
}

async function retrievesobjectfields(orgname, sobject){
    console.log('Push source to org...'); 
    try{
      return new Promise(async function (resolve, reject) {
          await exec('sfdx force:schema:sobject:describe -s '+sobject+' '+(orgname ? '-u '+ orgname : '') +' --json', (error, stdout, stderr) => {
            if (error){
                throw new SfdxError('Unable to retrieve sobject fields from scratch org!');
            }
            resolve(stdout? stdout : stderr);
          });
      });
    }catch(err){
      throw new SfdxError('Unable to retrieve sobject fields from scratch org!');
    }
}

export default class FieldSetCreate extends SfdxCommand {

    public static description = 'Create fieldset for specified object and push to scratch org.';
  
    public static examples = [
    `$ sfdx dxb:object:create --targetusername myOrg@example.com --objectname Invoice`
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        objectname: flags.string({char:'o',description:'Name of custom object',required:true}),
        fieldsetname: flags.string({char: 'n',description: 'Fieldset name',required:true}),
        retrievefields: flags.boolean({char: 'f',description: 'retrieve and display sobject fields in terminal'})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = true;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;
  
    public async run() {
        let orgname = this.org.getUsername();
        let sobject = this.flags.objectname;
        let name = this.flags.fieldsetname;

        var vrpath = `./force-app/main/default/objects/${sobject}/fieldSets`;
        if (!fs.existsSync(vrpath)) {
            fs.mkdirSync(vrpath);
        }

        let apiname = name.replace(new RegExp(`[^A-Z0-9]`,'gi'), '_');
        content = content.replace(new RegExp(`{{label}}`, 'g'), name);
        content = content.replace(new RegExp(`{{fullname}}`, 'g'), apiname);

        updateContent('description','Description: ');

        if (this.flags.retrievefields){
            var objectschema = retrievesobjectfields(orgname,sobject).toString();
            objectschema = JSON.parse(objectschema);

            if (objectschema.result.queryable){
                var fields = "Name";
                objectschema.result.fields.forEach(function(f){
                    if(!f.deprecatedAndHidden && f.name !== 'Name') fields = fields +","+ f.name;
                });
            }
            console.log('\n=== Available Object Fields \n'+fields+'\n');
        }
        var stdin = require('readline-sync');
        var res = stdin.question('Fields (APIName with comma separated): ');
        res.split(',').forEach(function(elem){
            var displayFieldTemplate = 
            '   <displayedFields>\n'+
            '       <field>{{fieldname}}</field>\n'+
            '   </displayedFields>\n';
            fieldlist += displayFieldTemplate.replace(new RegExp(`{{fieldname}}`, 'g'), elem.trim());
        });
        content = content.replace(new RegExp(`{{fieldlist}}`, 'g'), fieldlist);

        //update content file
        const fullpath = vrpath+'/'+apiname+'.fieldSet-meta.xml';
        fs.writeFileSync(fullpath, content);
        console.log(`\n=== Fieldset created successfully\n${fullpath}\n`);

        var output = push_source(orgname);
        console.log(output);
    }
}