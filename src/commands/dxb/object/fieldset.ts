import { execSync as exec } from 'child_process';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Connection, Messages } from '@salesforce/core';
import * as fs from 'fs-extra';
import { DescribeSObjectResult } from 'jsforce';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'object.fieldset');

export type ObjectFieldsetResult = {
  output: string;
};

export default class ObjectFieldset extends SfCommand<ObjectFieldsetResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'object-name': Flags.string({
      char: 's',
      summary: messages.getMessage('flags.object-name.summary'),
      required: true,
      aliases: ['objectname'],
      deprecateAliases: true,
    }),
    'fieldset-name': Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.fieldset-name.summary'),
      required: true,
      aliases: ['fieldsetname'],
      deprecateAliases: true,
    }),
    'retrieve-fields': Flags.boolean({
      char: 'f',
      summary: messages.getMessage('flags.retrieve-fields.summary'),
      aliases: ['retrievefields'],
      deprecateAliases: true,
    }),
    push: Flags.boolean({ char: 'p', summary: messages.getMessage('flags.push.summary'), default: false }),
  };

  protected connection: Connection | undefined;

  private content: string = messages.getMessage('data.fieldset');

  public async run(): Promise<ObjectFieldsetResult> {
    const { flags } = await this.parse(ObjectFieldset);
    const orgname = flags['target-org']?.getUsername();
    this.connection = flags['target-org']?.getConnection();
    const sobject = flags['object-name'];
    const name = flags['fieldset-name'];

    const fsPath = `./force-app/main/default/objects/${sobject}/fieldSets`;
    fs.ensureDirSync(fsPath);

    const apiname = name.replace(new RegExp('[^A-Z0-9]', 'gi'), '_');
    this.content = this.content.replace(new RegExp('{{label}}', 'g'), name);
    this.content = this.content.replace(new RegExp('{{fullname}}', 'g'), apiname);

    await this.updateContent('description', messages.getMessage('prompt.message.description'));

    if (flags.retrievefields) {
      const objectschema = await this.retrievesobjectfields(orgname!, sobject);

      if (objectschema?.queryable) {
        let fields = 'Name';
        objectschema.fields.forEach((f) => {
          if (!f.deprecatedAndHidden && f.name !== 'Name') {
            fields = fields + ',' + f.name;
          }
        });
        this.log(messages.getMessage('log.availableFields', [fields]));
      }
    }
    const prompt = await this.prompt<{ response: string }>({
      type: 'input',
      name: 'response',
      message: messages.getMessage('prompt.message.fields'),
    });
    let fieldList = '';
    prompt.response.split(',').forEach((elem) => {
      const displayFieldTemplate =
        '   <displayedFields>\n' + '       <field>{{fieldname}}</field>\n' + '   </displayedFields>\n';
      fieldList += displayFieldTemplate.replace(new RegExp('{{fieldname}}', 'g'), elem.trim());
    });
    this.content = this.content.replace(new RegExp('{{fieldlist}}', 'g'), fieldList);

    // update content file
    const fullpath = fsPath + '/' + apiname + '.fieldSet-meta.xml';
    fs.writeFileSync(fullpath, this.content);
    this.log(messages.getMessage('log.fieldsetCreated', [fullpath]));

    const output = await this.pushSource(orgname!, await flags['target-org']?.determineIfScratch(), fullpath);
    return { output };
  }
  private async updateContent(varName: string, question: string): Promise<void> {
    const prompt = await this.prompt<{ response: string }>({
      type: 'input',
      name: 'response',
      message: question,
    });

    this.content = this.content.replace(new RegExp(`{{${varName}}}`, 'g'), prompt.response);
  }

  private async pushSource(orgname: string, usesScratchOrg: boolean | undefined, path: string): Promise<string> {
    this.log('Push source to org...');
    const command = usesScratchOrg
      ? `sf project deploy start --ignore-warnings --ignore-conflicts --target-org ${orgname}`
      : `sf project deploy start --ignore-warnings --ignore-conflicts --target-org ${orgname} --source-directory ${path}`;
    try {
      return await new Promise((resolve) => resolve(exec(command).toString()));
    } catch (err) {
      throw messages.createError('error.pushFailed');
    }
  }

  private async retrievesobjectfields(orgname: string, sobject: string): Promise<DescribeSObjectResult | undefined> {
    this.log(messages.getMessage('log.getFields', [sobject, orgname]));
    return this.connection?.describeSObject(sobject);
  }
}
