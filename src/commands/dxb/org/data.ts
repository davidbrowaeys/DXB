import * as fs from 'fs';
import {Flags, SfCommand} from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
type EnvRule = {
  source: string;
  target: string;
}
type EnvFile = {
  pagePath: string;
  replacerules: EnvRule[];
}
type OrgDataResult = {
  success: boolean;
}
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'org.data');
export default class OrgData extends SfCommand<OrgDataResult> {

  public static readonly summary = messages.getMessage('summary');

  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessages('examples')

  public static readonly flags = {
    config: Flags.file({ char: 'f', summary: messages.getMessage('flags.config.summary'), required:true, exists: true}),
    environment: Flags.string({ char: 'e', summary: messages.getMessage('flags.environment.summary'), required:true})
  };

  public async run(): Promise<OrgDataResult> {
    // flags
    const {flags} = await this.parse(OrgData);
    const config = flags.config;
    const environment = flags.environment;

    const envMapping = JSON.parse(fs.readFileSync(config).toString());
    envMapping[environment].forEach((file: EnvFile) => {
      this.log(messages.getMessage('log.processing', [file.pagePath]));
      let fileContent = fs.readFileSync(file.pagePath).toString();
      file.replacerules.forEach(rule => {
        fileContent = fileContent.replace(new RegExp(rule.source,'g'), rule.target);
      });
      fs.writeFileSync(file.pagePath, fileContent);
    });
    return { success: true };
  }
}