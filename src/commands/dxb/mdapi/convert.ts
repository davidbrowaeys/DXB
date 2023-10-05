import { execSync as exec } from 'child_process';
import {Flags, SfCommand } from '@salesforce/sf-plugins-core';
import * as fs from 'fs-extra';
import { Messages } from '@salesforce/core';
type MDAPIConvertResult = {
  success: boolean;
}
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'mdapi.convert');
export default class MDAPIConvert extends SfCommand<MDAPIConvertResult> {

  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'output-dir' :Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.output-dir.summary'),
      exists: true,
      default: '.'
    }),
    'root-dir' :Flags.directory({
      char: 'r',
      required:true,
      summary: messages.getMessage('flags.root-dir.summary'),
      exists: true
    })
  };

  public async run(): Promise<MDAPIConvertResult> {
    const {flags} = await this.parse(MDAPIConvert);
    const rootdir = flags['root-dir'];
    const outputdir = flags['output-dir'];

    this.log(`sf project convert mdapi --root-dir ${rootdir} --output-dir ${outputdir} --json`);
    const output: any = JSON.parse(exec(`sf project convert mdapi --root-dir ${rootdir} --output-dir ${outputdir} --json`).toString());
    const result: any[] = output.result;
    result.forEach((elem) => {
      if (elem.filePath.includes('.dup')){
        const oldPath = elem.filePath.substring(0,elem.filePath.length - 4);
        fs.unlinkSync(oldPath);
        fs.renameSync(elem.filePath, oldPath);
        this.log(oldPath);
      } else {
        this.log(elem.filePath);
      }
    });
    return { success: true };
  }
}
