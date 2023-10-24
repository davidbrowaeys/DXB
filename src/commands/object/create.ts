import { execSync as exec } from 'child_process';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, NamedPackageDir, SfProject } from '@salesforce/core';
import * as fs from 'fs-extra';

type ObjectCreateResult = {
  success: boolean;
};

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'object.create');
export default class ObjectCreate extends SfCommand<ObjectCreateResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'object-name': Flags.string({
      char: 's',
      summary: messages.getMessage('flags.object-name.summary'),
      required: true,
    }),
    push: Flags.boolean({ char: 'p', default: false, summary: messages.getMessage('flags.push.summary') }),
  };

  private content: string = messages.getMessage('data.object');

  public async run(): Promise<ObjectCreateResult> {
    const { flags } = await this.parse(ObjectCreate);
    const orgname = flags['target-org']?.getUsername();
    const pushToOrg: boolean = flags.push;
    const defaultPackageDir: NamedPackageDir = (await SfProject.resolve()).getDefaultPackage();
    const name = flags['object-name'];

    const apiname = name.replace(new RegExp('[^A-Z0-9]', 'gi'), '_') + '__c';
    const objectpath = `${defaultPackageDir.fullPath}/objects/${apiname}`;
    if (fs.existsSync(objectpath)) {
      throw messages.createError('error.exists');
    }
    fs.mkdirSync(objectpath);
    this.content = this.content.replace(new RegExp('{{label}}', 'g'), name);

    await this.updateContent('description', messages.getMessage('prompt.message.description'));
    const sharingmodel = await this.updateContent('sharingmodel', messages.getMessage('prompt.message.sharingModel'));
    if (sharingmodel === 'ControlledByParent') {
      this.log(messages.getMessage('log.sharingControlledByParent'));
      let masterfield = messages.getMessage('data.master');

      let prompt = await this.prompt<{ response: string }>({
        type: 'input',
        name: 'response',
        message: messages.getMessage('prompt.message.masterObject'),
      });
      const masterobject = prompt.response;

      prompt = await this.prompt<{ response: string }>({
        type: 'input',
        name: 'response',
        message: messages.getMessage('prompt.message.masterLabel'),
      });
      const masterlabel = prompt.response;

      prompt = await this.prompt<{ response: string }>({
        type: 'input',
        name: 'response',
        message: messages.getMessage('prompt.message.relationshipName'),
      });
      const relationshipLabel = prompt.response;

      const fieldname = masterlabel.replace(new RegExp('[^A-Z0-9]', 'gi'), '_') + '__c';
      masterfield = masterfield.replace(new RegExp('{{fieldname}}', 'g'), fieldname);
      masterfield = masterfield.replace(new RegExp('{{fieldlabel}}', 'g'), masterlabel);
      masterfield = masterfield.replace(new RegExp('{{masterobject}}', 'g'), masterobject);
      const relationshipName = relationshipLabel.replace(new RegExp('[^A-Z0-9]', 'gi'), '_');
      masterfield = masterfield.replace(new RegExp('{{relationshipLabel}}', 'g'), relationshipLabel);
      masterfield = masterfield.replace(new RegExp('{{relationshipName}}', 'g'), relationshipName);

      fs.mkdirSync(`${objectpath}/fields`);
      fs.writeFileSync(`${objectpath}/fields/${fieldname}.field-meta.xml`, masterfield);
    }

    // update content file
    const fullpath = objectpath + '/' + apiname + '.object-meta.xml';
    fs.writeFileSync(fullpath, this.content);
    this.log(messages.getMessage('log.objectCreated', [fullpath]));

    if (pushToOrg) {
      const usesScratchOrg = (await flags['target-org']?.determineIfScratch()) ?? false;
      const output = await this.pushSource(orgname!, usesScratchOrg, fullpath);
      this.log(output);
    }

    return { success: true };
  }

  private async updateContent(varName: string, question: string): Promise<string> {
    const answer = await this.prompt<{ res: string }>({
      type: 'input',
      name: 'res',
      message: question,
    });

    this.content = this.content.replace(new RegExp(`{{${varName}}}`, 'g'), answer.res);

    return answer.res;
  }

  private async pushSource(orgname: string, usesScratchOrg: boolean, path: string): Promise<string> {
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
}
