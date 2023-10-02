import path = require('path');
import fse = require('fs-extra');

import {Flags, SfCommand} from '@salesforce/sf-plugins-core';
import { Messages, SfProject } from '@salesforce/core';

type ApexTriggerCreationResult = {
  success: boolean;
}


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'apex.trigger.create');

export default class ApexTriggerCreation extends SfCommand<ApexTriggerCreationResult> {

  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    sobject: Flags.string({
      char: 's',
      required: true,
      summary: messages.getMessage('flags.sobject.summary')
    }),
    'source-api-version': Flags.integer({
      char: 'v',
      summary: messages.getMessage('flags.source-api-version.summary')
    })
  };

  public async run(): Promise<ApexTriggerCreationResult> {
    const {flags} = await this.parse(ApexTriggerCreation);
    const project = await SfProject.resolve();
    const config: any = await project.resolveProjectConfig();
    const sobject = flags.sobject;
    const apiversion: number = flags['source-api-version'] ?? config.sourceApiVersion;

    const template = 'trigger';
    const vars =    'className=' + sobject.replace('__c', '').replace('_', '') + 'TriggerHandler,' +
    'triggerName=' + sobject.replace('__c', '').replace('_', '') + 'Trigger,' +
    'apiVersion=' + apiversion.toPrecision(3) + ',' +
    'sobject=' + sobject;

    let templateFolder = path.join('.sfdx-templates', template);
    if (!fse.existsSync(templateFolder)) {
      templateFolder = path.join(__dirname, '../../../../utils/templates/', template);
    }
    this.log(templateFolder);

    this.createFiles(templateFolder, sobject, vars);
    return { success: true };
  }

  private createFiles(templateFolder: string, sobject: string, vars: string): void {

    const name = sobject.replace('__c', '').replace('_', '') + 'Trigger';
    const outputdir = './force-app/main/default';

    if (!fse.existsSync(templateFolder)) {
      this.error(messages.getMessage('error.templateNotExist'));
    }

    const defJsonPath = path.join(templateFolder, 'def.json');

    if (!fse.existsSync(defJsonPath)) {
      this.error(messages.getMessage('error.defJsonNotFound'));
    }

    const defJson: { files: string[][]; vars: string } = JSON.parse(fse.readFileSync(defJsonPath).toString());
    const defJsonVars = defJson.vars;

    if (!vars) {
      this.error(messages.getMessage('error.defJSONVars', [defJsonVars]));
    }

    const filesCreated: string[] = [];

    defJson.files.forEach((row) => {
      const fileName = row[0];
      const fileExtension = row[1];
      if (fileName !== 'def.json') {

        const templateFilePath = path.join(templateFolder, fileName);
        let content = fse.readFileSync(templateFilePath).toString();

        const splitVars = vars.split(',');
        splitVars.forEach((value) => {
          content = updateContent(content, value);
        });
        content = updateContent(content, 'sobject='+sobject);

        let newFile = path.join(`${outputdir}/triggers`, `${name}.${fileExtension}`);
        if (fileExtension.toString().includes('cls')) {
          newFile = path.join(`${outputdir}/classes`, `${name}Handler.${fileExtension}`);
        }

        const newFilePath = path.dirname(newFile);

        fse.ensureDirSync(newFilePath);
        fse.writeFileSync(newFile, content);
        filesCreated.push(newFile);
      }
    });

    let result = 'The following files were created:';
    for (const createdFile of filesCreated) {
      result += `\n  ${createdFile}`
    }

    this.log(result);
  }
}

function updateContent(content: string, values: string): string {
  const splitValues = values.split('=');

  const varName = splitValues[0];
  const varValue = splitValues[1];
  content = content.replace(new RegExp(`{{${varName}}}`, 'g'), varValue);
  return content;
}
