import { flags, SfdxCommand } from '@salesforce/command';
import { SfError } from '@salesforce/core';

const fs = require('fs');
const exec = require('child_process').exec;

var content =  '<?xml version="1.0" encoding="UTF-8"?>\n'+
                '<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">\n'+
                '   <actionOverrides>\n'+
                '       <actionName>Accept</actionName>\n'+
                '       <type>Default</type>\n'+
                '   </actionOverrides>\n'+
                '   <actionOverrides>\n'+
                '       <actionName>CancelEdit</actionName>\n'+
                '       <type>Default</type>\n'+
                '   </actionOverrides>\n'+
                '   <actionOverrides>\n'+
                '       <actionName>Clone</actionName>\n'+
                '       <type>Default</type>\n'+
                '   </actionOverrides>\n'+
                '   <actionOverrides>\n'+
                '       <actionName>Delete</actionName>\n'+
                '       <type>Default</type>\n'+
                '   </actionOverrides>\n'+
                '   <actionOverrides>\n'+
                '       <actionName>Edit</actionName>\n'+
                '       <type>Default</type>\n'+
                '   </actionOverrides>\n'+
                '   <actionOverrides>\n'+
                '       <actionName>List</actionName>\n'+
                '       <type>Default</type>\n'+
                '   </actionOverrides>\n'+
                '   <actionOverrides>\n'+
                '       <actionName>New</actionName>\n'+
                '       <type>Default</type>\n'+
                '   </actionOverrides>\n'+
                '   <actionOverrides>\n'+
                    '   <actionName>SaveEdit</actionName>\n'+
                    '   <type>Default</type>\n'+
                '   </actionOverrides>\n'+
                '   <actionOverrides>\n'+
                '       <actionName>Tab</actionName>\n'+
                '       <type>Default</type>\n'+
                '   </actionOverrides>\n'+
                '   <actionOverrides>\n'+
                '       <actionName>View</actionName>\n'+
                '       <type>Default</type>\n'+
                '   </actionOverrides>\n'+
                '   <allowInChatterGroups>false</allowInChatterGroups>\n'+
                '   <compactLayoutAssignment>SYSTEM</compactLayoutAssignment>\n'+
                '   <deploymentStatus>Deployed</deploymentStatus>\n'+
                '   <description>{{description}}</description>\n'+
                '   <enableActivities>true</enableActivities>\n'+
                '   <enableBulkApi>true</enableBulkApi>\n'+
                '   <enableChangeDataCapture>false</enableChangeDataCapture>\n'+
                '   <enableFeeds>false</enableFeeds>\n'+
                '   <enableHistory>true</enableHistory>\n'+
                '   <enableReports>true</enableReports>\n'+
                '   <enableSearch>true</enableSearch>\n'+
                '   <enableSharing>true</enableSharing>\n'+
                '   <enableStreamingApi>true</enableStreamingApi>\n'+
                '   <label>{{label}}</label>\n'+
                '   <nameField>\n'+
                '       <label>{{label}} Name</label>\n'+
                '       <type>Text</type>\n'+
                '   </nameField>\n'+
                '   <pluralLabel>{{label}}s</pluralLabel>\n'+
                '   <searchLayouts/>\n'+
                '   <sharingModel>{{sharingmodel}}</sharingModel>\n'+
                '</CustomObject>';

function updateContent(varName, question) {
    var stdin = require('readline-sync');
    var res = stdin.question(question);
    
    content = content.replace(new RegExp(`{{${varName}}}`, 'g'), res);

    return res;
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
      throw new SfError('Unable to push source to scratch org!');
    }
}

export default class ObjectCreate extends SfdxCommand {

    public static description = 'Refresh scratch org by deleting local sync file, reset some metadata by target username, and re-push all to scratch org.';
  
    public static examples = [
    `$ sfdx dxb:object:create --targetusername myOrg@example.com --objectname Invoice`
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        objectname: flags.string({char:'o',description:'Name of custom object',required:true})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = true;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;
  
    public async run() {
        let orgname = this.org.getUsername();
        let name = this.flags.objectname;

        let apiname = name.replace(new RegExp(`[^A-Z0-9]`,'gi'), '_') + '__c';
        var objectpath = `./force-app/main/default/objects/${apiname}`;
        if (fs.existsSync(objectpath)) {
            console.log("This object already exists");
            process.exit(0);
        }
        fs.mkdirSync(objectpath);
        content = content.replace(new RegExp(`{{label}}`, 'g'), name);

        updateContent('description','Description: ');
        var sharingmodel = updateContent('sharingmodel','Sharing Model (Private|Public|ControlledByParent) :');
        if (sharingmodel === 'ControlledByParent'){
            console.log('When sharing model is set as controlled by parent, you must define master details :');
            var masterfield =   
                    '<?xml version="1.0" encoding="UTF-8"?>\n'+
                    '<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">\n'+
                    '    <fullName>{{fieldname}}</fullName>\n'+
                    '    <externalId>false</externalId>\n'+
                    '    <label>{{fieldlabel}}</label>\n'+
                    '    <referenceTo>{{masterobject}}</referenceTo>\n'+
                    '    <relationshipLabel>{{relationshipLabel}}</relationshipLabel>\n'+
                    '    <relationshipName>{{relationshipName}}</relationshipName>\n'+
                    '    <relationshipOrder>0</relationshipOrder>\n'+
                    '    <reparentableMasterDetail>true</reparentableMasterDetail>\n'+
                    '    <trackHistory>false</trackHistory>\n'+
                    '    <trackTrending>false</trackTrending>\n'+
                    '    <type>MasterDetail</type>\n'+
                    '    <writeRequiresMasterRead>false</writeRequiresMasterRead>\n'+
                    '</CustomField>';
            var stdin = require('readline-sync');
            var masterobject = stdin.question('Master object(API name), i.e.: Account, Invoice__c:');
            var masterlabel = stdin.question('Master field label:');
            var relationshipLabel = stdin.question('Relationship name(i.e.:"Drawdowns", "Invoice Lines"):');

            var fieldname = masterlabel.replace(new RegExp(`[^A-Z0-9]`,'gi'), '_') + '__c';
            masterfield = masterfield.replace(new RegExp(`{{fieldname}}`, 'g'), fieldname);
            masterfield = masterfield.replace(new RegExp(`{{fieldlabel}}`, 'g'), masterlabel);
            masterfield = masterfield.replace(new RegExp(`{{masterobject}}`, 'g'), masterobject);
            let relationshipName = relationshipLabel.replace(new RegExp(`[^A-Z0-9]`,'gi'), '_');
            masterfield = masterfield.replace(new RegExp(`{{relationshipLabel}}`, 'g'), relationshipLabel);
            masterfield = masterfield.replace(new RegExp(`{{relationshipName}}`, 'g'), relationshipName);

            fs.mkdirSync(objectpath+'/fields');
            fs.writeFileSync(objectpath+'/fields/'+fieldname+'.field-meta.xml', masterfield);
        }

        //update content file
        const fullpath = objectpath+'/'+apiname+'.object-meta.xml';
        fs.writeFileSync(fullpath, content);
        console.log(`\n=== Custom Object created successfully\n ${fullpath}\n`);

        var output = push_source(orgname);
        console.log(output);
    }
}