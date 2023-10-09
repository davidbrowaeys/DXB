import * as path from 'path';
import * as fs from 'fs';
import {Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { SfProject, NamedPackageDir, Messages } from '@salesforce/core';

type Rule = {
  replaceby: string;
  regex: string;
  mergefield: string;
}
type DefaultConfig = {
  folder: string;
  rules: Rule[];
}
type MetadataResetResult = {
  success: boolean;
}
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'org.setdefaults');
export default class MetadataReset extends SfCommand<MetadataResetResult> {

  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'base-dir': Flags.string({char: 'd', summary: messages.getMessage('flags.base-dir.summary')})
  };

  public async run(): Promise<MetadataResetResult> {
    const {flags} = await this.parse(MetadataReset);
    const project = await SfProject.resolve();
    const packageDir: NamedPackageDir = project.getDefaultPackage();
    let config: any = await project.resolveProjectConfig();
    if (!config.plugins?.dxb){
      throw messages.createError('error.badConfig')
    }
    config = config.plugins.dxb;

    const orgname = flags['target-org']!.getUsername()!;
    const baseDir = flags['base-dir'] ?? packageDir.fullPath;
    this.log(messages.getMessage('log.welcome'));

    config.orgdefault_config.forEach((element: DefaultConfig) => {
      const dirpath = path.join(baseDir,element.folder);
      if (fs.existsSync(dirpath)){
        this.log(`* Processing ${element.folder} :`);
        fs.readdirSync(dirpath).forEach(file => {
          this.log(`>    ${file}`);
          this.applyRules(element.rules, dirpath+'/'+file,orgname);
        });
      }
    });
    return { success: true };
  }
  // eslint-disable-next-line class-methods-use-this
  private applyRules(rules: Rule[], dirfile: string, username: string): void{
    let content = fs.readFileSync(dirfile).toString();
    rules.forEach(element => {
      let value = element.replaceby;
      if (element.mergefield === 'username') {
        value = value.split('{{mergevalue}}').join(username);
      }
      content = content.replace(new RegExp(element.regex,'g'), value);
    });
    fs.writeFileSync(dirfile, content);
  }
}
