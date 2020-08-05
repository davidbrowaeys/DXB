import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxProject, SfdxError } from '@salesforce/core';

const exec = require('child_process').execSync;
const execAsync = require('child_process').exec;
const path = require('path');
const fse = require('fs-extra');
const fs = require('fs');
const os = require('os');

export default class ApexTriggerCreation extends SfdxCommand {

    public static description = 'Create scratch org';

    public static examples = [
        `$ sfdx dxb:apex:trigger:create -o Account`
    ];

    public static args = [{ name: 'file' }];

    protected static flagsConfig = {
        sobject: flags.string({
            char: 'o',
            required: true,
            description: 'api name of SObject'
        }),
        apiversion: flags.number({
            char: 'v',
            description: 'set api version of the generated class'
        })
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = false;

    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;

    public async run() {
        const project = await SfdxProject.resolve();
        var config: any = await project.resolveProjectConfig();
        const sobject = this.flags.sobject;
        const apiversion = this.flags.apiversion | config.sourceApiVersion;

        const template = 'trigger';
        const vars =    'className=' + sobject.replace('__c', '').replace('_', '') + 'TriggerHandler,' +
                        'triggerName=' + sobject.replace('__c', '').replace('_', '') + 'Trigger,' +
                        'apiVersion=' + apiversion.toPrecision(3); + ',' +
                        'sobject=' + sobject;
        
        let templateFolder = path.join('.sfdx-templates', template);
        if (!fse.existsSync(templateFolder)) {
            templateFolder = path.join(__dirname, '../../../../lib/templates/', template);
        }
        console.log(templateFolder);
    
        createFiles(templateFolder, sobject, vars, null);
    }

}

function updateContent(content, values) {
    const splitValues = values.split('=');

    const varName = splitValues[0];
    const varValue = splitValues[1];
    content = content.replace(new RegExp(`{{${varName}}}`, 'g'), varValue);
    return content;
}

function createFiles(templateFolder, sobject, vars, done) {

    const name = sobject.replace('__c', '').replace('_', '') + 'Trigger';
    const outputdir = './force-app/main/default';

    if (!fse.existsSync(templateFolder)) {
        done(`specified template 'trigger' doesn't exist`, null);
    }

    const defJsonPath = path.join(templateFolder, 'def.json');

    if (!fse.existsSync(defJsonPath)) {
        done('def.json not found', null);
    }

    const defJson = JSON.parse(fs.readFileSync(defJsonPath).toString());
    const defJsonVars = defJson.vars;

    if (!vars) {
        done(`The following variables are required: ${defJsonVars}. Specify them like: -v className=myclass,apiName=40.0`, null);
    }

    const filesCreated = [];

    defJson.files.forEach((row) => {
        const fileName = row[0];
        const fileExtension = row[1];
        if (fileName !== 'def.json') {

            const templateFilePath = path.join(templateFolder, fileName);
            let content = fs.readFileSync(templateFilePath).toString();

            const splitVars = vars.split(',');
            splitVars.forEach((value) => {
                content = updateContent(content, value);
            });
            
            let newFile = path.join(`${outputdir}/triggers`, `${name}.${fileExtension}`);
            if (fileExtension.toString().includes('cls')) {
                newFile = path.join(`${outputdir}/classes`, `${name}Handler.${fileExtension}`);
            }

            const newFilePath = path.dirname(newFile);

            fse.ensureDirSync(newFilePath);
            fs.writeFileSync(newFile, content);
            filesCreated.push(newFile);
        }
    });

    let result = 'The following files were created:';
    for (let i = 0; i < filesCreated.length; i++) {
        result += `\n  ${filesCreated[i]}`;
    }

    console.log(result);
}
