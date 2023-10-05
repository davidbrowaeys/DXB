import * as fs from 'fs';
import * as path from 'path';
import {Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Connection, Messages } from '@salesforce/core';
import {createObjectCsvWriter as createCsvWriter} from 'csv-writer';

type Header = {
  id: string;
  title: string;
}
type GenericObject = {
  [key: string]: any;
}
type DataExportResult = {
  success: boolean;
}
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'data.export');

export default class DataExport extends SfCommand<DataExportResult> {

  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples')

  public static readonly deprecateAliases = true;
  public static readonly aliases = [
    'dxb:data:transfer:export'
  ]

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'definition-file': Flags.file({char:'f',summary: messages.getMessage('flags.definition-file.summary'),required:true, exists: true}),
    'output-dir':Flags.directory({char:'d',summary: messages.getMessage('flags.output-dir.summary'),default:'.', exists: true}),
    'query-limit':Flags.integer({char:'l',summary: messages.getMessage('flags.query-limit.summary'),default:500000, min: 1}),
  };

  protected connection: Connection | undefined;
  protected outputdir: string | undefined;
  protected csvWriter: any;
  protected querylimit: number | undefined;

  public async run(): Promise<DataExportResult> {
    const {flags} = await this.parse(DataExport);
    const definitionfile = flags['definition-file'];
    this.outputdir = flags['output-dir']!;
    this.querylimit = flags['query-limit'];
    this.connection = flags['target-org']!.getConnection();
    JSON.parse(fs.readFileSync(definitionfile).toString()).objects
    .reduce(
      (accumulatorPromise: Promise<any>, elem: GenericObject) =>
        accumulatorPromise.then(() => {
          if (elem.active) {
            return this.export(elem);
          } else {
            return;
          }
        }),
        Promise.resolve()
      );
      return { success: true }
    }

  private export(job: GenericObject): void{
    job.fields = job.fields.replace(/ /g,'');
    const exportfile = path.join(this.outputdir!,job.filename);
    this.log(messages.getMessage('log.registerExport', [`[\x1b[33m${job.objectName},${exportfile}\x1b[0m]`]));
    let query: string = `select ${job.fields.replace(/ /g,'')} from ${job.objectName}`;
    if (job.where){
      query += ` where ${job.where}`;
    }
    job.fields = job.fields.split(',');
    job['exportfile'] = exportfile;
    job['query'] = query;
    this.startQuery(job);
  }

  private startQuery(job: GenericObject): void{
    const records: GenericObject[] = [];
    const query: any = this.connection!.query(job.query)
    .on('record', (record) => {
      records.push(record);
    })
    .on('end', () => {
      this.log(messages.getMessage('log.exportResult',[`\x1b[32m${query.totalFetched}\x1b[0m`]));
      const headers: Header[] = [];
      job.fields.forEach((key: string) => {
        const k = key.trim().toLowerCase();
        headers.push({id: k, title: k});
      });
      const csvWriter = createCsvWriter({
        path: job.exportfile,
        header: headers,
        encoding:'utf-8'
      });
      records.forEach(element => {
        job.fields.forEach((key: string) => {
          const k = key.trim().toLowerCase();
          if (k.includes('.')){ // handle cross reference fields
            const f = key.split('.');
            element[k] = element[f[0]] ? element[f[0]][f[1]] : undefined;
            delete element[f[0]];
          }else{  // just a normal field
            element[k] = element[key];
            delete element[key];
          }
        });
        delete element.attributes;
      });
      void csvWriter.writeRecords(records)       // returns a promise
      return job;
    })
    .on('error', (err) => {
      this.error(err);
    })
    .run({ autoFetch : true, maxFetch : this.querylimit }); // synonym of Query#execute();
  }
}
