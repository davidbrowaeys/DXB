import { execSync } from 'child_process';
import {Flags, SfCommand } from '@salesforce/sf-plugins-core';
import * as fs from 'fs-extra';
import { Messages, NamedPackageDir, SfProject } from '@salesforce/core';

type ValidationRuleCreateResult = {
  success: boolean;
}

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'object.vr.create');
export default class ValidationRuleCreate extends SfCommand<ValidationRuleCreateResult> {

  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    name: Flags.string({char: 'n',summary: messages.getMessage('flags.name.summary'),required: true}),
    'object-name': Flags.string({char: 's',summary: messages.getMessage('flags.object-name.summary'),required: true}),
    push:Flags.boolean({char: 'p',summary: messages.getMessage('flags.push.summary'), default: false})
  };

  private content: string =  '<?xml version="1.0" encoding="UTF-8"?>\n'+
  '<ValidationRule xmlns="http://soap.sforce.com/2006/04/metadata">\n'+
  '    <fullName>{{fullname}}</fullName>\n'+
  '    <active>true</active>\n'+
  '    <description>{{description}}</description>\n'+
  '    <errorConditionFormula>{{formula}}</errorConditionFormula>\n'+
  '    <errorMessage>{{errorMessage}}</errorMessage>\n'+
  '</ValidationRule>';

  public async run(): Promise<ValidationRuleCreateResult> {
    const {flags} = await this.parse(ValidationRuleCreate);
    const orgname = flags['target-org']!.getUsername();
    const sobject = flags['object-name'];
    const defaultPackageDir: NamedPackageDir = (await SfProject.resolve()).getDefaultPackage();
    const name = flags.name;

    const vrpath = `${defaultPackageDir.fullPath}/objects/${sobject}/validationRules`;
    fs.ensureDirSync(vrpath);

    const apiname = name.replace(new RegExp('[^A-Z0-9]','gi'), '_');
    this.content = this.content.replace(new RegExp('{{fullname}}', 'g'), apiname);

    await this.updateContent('description','Description: ');
    await this.updateContent('errorMessage','Error message: ');
    await this.updateContent('formula','Formula:\n');

    // update content file
    const fullpath = `${vrpath}/${apiname}.validationRule-meta.xml`;
    fs.writeFileSync(fullpath, this.content);
    this.log(messages.getMessage('log.vrCreated', [fullpath]));

    if (flags.push){
      const isScratch: boolean = await flags['target-org']!.determineIfScratch();
      await this.pushSource(orgname!, isScratch, fullpath);
    }
    return { success: true };
  }

  private async updateContent(varName: string, question: string): Promise<void> {
    const answer = await this.prompt<{res: string}>({
      type: 'input',
      name: 'res',
      message: question
    });
    this.content = this.content.replace(new RegExp(`{{${varName}}}`, 'g'), answer.res);
  }

  private async pushSource(orgname: string, usesScratchOrg: boolean, path: string): Promise<string>{
    this.log('Push source to org...');
    const command = usesScratchOrg
    ? `sf project deploy start --ignore-warnings --ignore-conflicts --target-org ${orgname}`
    : `sf project deploy start --ignore-warnings --ignore-conflicts --target-org ${orgname} --source-directory ${path}`;
    try{
      return await new Promise((resolve) => resolve(execSync(command).toString()));
    } catch(err){
      throw messages.createError('error.pushFailed');
    }
  }
}