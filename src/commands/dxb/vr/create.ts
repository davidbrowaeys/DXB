
import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError } from '@salesforce/core';

const fs = require('fs');
const execAsync = require('child_process').exec;
var stdin = require('readline-sync');

var content =  '<?xml version="1.0" encoding="UTF-8"?>\n'+
                '<ValidationRule xmlns="http://soap.sforce.com/2006/04/metadata">\n'+
                '    <fullName>{{fullname}}</fullName>\n'+
                '    <active>true</active>\n'+
                '    <description>{{description}}</description>\n'+
                '    <errorConditionFormula>{{formula}}</errorConditionFormula>\n'+
                '    <errorMessage>{{errorMessage}}</errorMessage>\n'+
                '</ValidationRule>';

function updateContent(varName, question) {
    var res = stdin.question(question);
    content = content.replace(new RegExp(`{{${varName}}}`, 'g'), res);
}

async function push_source(orgname){
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

export default class ValidationRuleCreate extends SfdxCommand {

  public static description = 'This command create a validation rule against specified object.';

  public static examples = [
  `$ sfdx dxb:vr:create`
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    name: flags.string({char:'n',description:'validation rule name',required:true}),
    objectname: flags.string({char:'o',description:'object name',required:true}),
    push:flags.boolean({char:'p',description:'push to scratch org'})
  };
  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run() {
    let orgname = this.flags.orgname;
    let sobject = this.flags.objectname;
    let name = this.flags.name;

    var vrpath = `./force-app/main/default/objects/${sobject}/validationRules`;
    if (!fs.existsSync(vrpath)) {
        fs.mkdirSync(vrpath);
    }

    let apiname = name.replace(new RegExp(`[^A-Z0-9]`,'gi'), '_');
    content = content.replace(new RegExp(`{{fullname}}`, 'g'), apiname);

    updateContent('description','Description: ');
    updateContent('errorMessage','Error message: ');
    updateContent('formula','Formula:\n');

    //update content file
    const fullpath = vrpath+'/'+apiname+'.validationRule-meta.xml';
    fs.writeFileSync(fullpath, content);
    console.log(`Validation rule created successfully : \n ${fullpath}`);

    if (this.flags.push){
        push_source(orgname);
    }
  }
}