import * as xml2js from 'xml2js';
import {Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { existsSync, readFileSync } from 'fs-extra';

type CoverageCheckResult = {
  success: boolean;
};
type Coverage = {
  name: string;
  path: string;
  Time: string;
  Diff: string;
}

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'apex.coverage.check');

export default class CoverageCheck extends SfCommand<CoverageCheckResult> {

  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'file-path': Flags.string({ char: 'f', summary: messages.getMessage('flags.file-path.summary'), required: true }),
    'min-coverage': Flags.integer({ char: 'c', summary: messages.getMessage('flags.min-coverage.summary'), default: 95})
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  public static readonly requiresProject = true;

  public async run(): Promise<CoverageCheckResult> {
    const {flags} = await this.parse(CoverageCheck);
    const filePath: string = flags['file-path'];
    const threshold: number = flags['min-coverage'] / 100;
    const data = readFileSync(filePath,{encoding: 'utf-8'});
    if (!existsSync(filePath)) {
      throw new SfError('Coverage file not found: '+ filePath);
    }
    try {
      const result: any = await xml2js.parseStringPromise(data);

      const badClasses: any[] = [];
      result.coverage.packages[0].package[0].classes[0].class.forEach( (apex: any) => {
        if (parseFloat(apex.$['line-rate']) < threshold){
          badClasses.push(apex);
        }
      });
      if (badClasses && badClasses.length > 0 ){
        this.log(messages.getMessage('coverageTooLow', [threshold*100] ));
        const tableArray: Coverage[] = [];
        badClasses.forEach((item) => {
          const coverage: number = parseFloat(item.$['line-rate']);
          tableArray.push({
            name: item.$.name,
            path: item.$.filename,
            Time: `${item.$['line-rate'] * 100}%`,
            Diff: `-${((threshold - coverage) * 100).toFixed(2)}%`
          });
        });
        this.table(
          tableArray,
          {
            name: { header: 'NAME' },
            path: { header: 'PATH' },
            Time: { header: 'TIME' },
            Diff: { header: 'DIFF' },
          }
        );
        throw new SfError(messages.getMessage('insufficientCoverage'));
      } else {
        this.log(messages.getMessage('coverageIsOk'));
      }
      return { success:true };
    } catch (e: unknown) {
      const err = e as Error;
      throw new SfError(err.message);
    }
  }
}