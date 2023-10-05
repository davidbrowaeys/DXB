import * as fs from 'fs';
import * as path from 'path';
import {Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Connection, Messages } from '@salesforce/core';
import * as csv from 'csv-parser';
import {createObjectCsvWriter as createCsvWriter} from 'csv-writer';
import { BulkIngestBatchResult } from 'jsforce/lib/api/bulk';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const csvSplitStream = require('csv-split-stream');

type Header = {
  id: string;
  title: string;
}
type GenericObject = {
  [key: string]: any;
}
type BatchResult = {
  success: BulkIngestBatchResult;
  errors: BulkIngestBatchResult;
}
type DataImportResult = {
  success: boolean;
}
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'data.import');

export default class DataImport extends SfCommand<DataImportResult> {

  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly deprecateAliases = true;
  public static readonly aliases = [
    'dxb:data:transfer:import'
  ]

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'definition-file': Flags.file({char:'f',summary: messages.getMessage('flags.definition-file.summary'),required:true, exists: true}),
    'data-dir': Flags.directory({char:'d',summary: messages.getMessage('flags.data-dir.summary'),required:true, exists: true}),
    'polling-time-out': Flags.duration({ unit: 'milliseconds',char:'i',summary: messages.getMessage('flags.polling-time-out.summary')})
  };

  protected connection: Connection | undefined;
  protected setting: any;
  protected datadir: string | undefined;
  protected importdir: string | undefined;
  protected definitionfile: string | undefined;
  protected objectdescribes: any;
  public async run(): Promise<DataImportResult> {

    const {flags} = await this.parse(DataImport);
    this.definitionfile = flags['definition-file']!;
    this.datadir = flags['data-dir']!;
    this.setting = JSON.parse(fs.readFileSync(this.definitionfile).toString());
    this.objectdescribes = {};

    this.connection = flags['target-org']!.getConnection();
    this.connection.bulk.pollTimeout = flags['polling-time-out'] ?? this.setting.pollTimeout ?? 10000000; // 10 min
    if (!fs.existsSync(this.datadir)) {
      throw messages.createError('error.dataDirNotExist');
    }
    if (!fs.existsSync(path.join(this.datadir,'.tmp'))) {
      fs.mkdirSync(path.join(this.datadir,'.tmp'));
    }
    this.importdir = path.join(this.datadir,'.tmp','log_' + new Date().getTime());
    fs.mkdirSync(this.importdir);
    try {
      this.setting.objects.reduce( (accumulatorPromise: Promise<any>, elem: GenericObject) => accumulatorPromise.then(() => {
        if (elem.active) {
          return this.import(elem);
        }
        return null;
      }), Promise.resolve());
      return { success: true };
    } catch (e) {
      this.error((e as Error).message);
    }
  }

  private async import(config: GenericObject): Promise<void>{
    const filepath = path.join(this.datadir!,config.filename);
    const importfile = path.join(this.importdir!,`tmp_${config.filename}`);
    this.log(messages.getMessage('log.registerImport',[`[\x1b[33m${config.objectName},${filepath}\x1b[0m]`]));
    if (this.objectdescribes[config.objectName] === undefined) {
      this.objectdescribes[config.objectName] = await this.getObjectDescribe(config.objectName);
    }
    if (config.fields === '*') {
      config.fields = this.objectdescribes[config.objectName].fields;
    }else{
      config.fields = config.fields.split(',');
    }
    config['importfile'] = importfile;
    config['filepath'] = filepath;
    this.log(messages.getMessage('log.preparing'));
    const results = this.initFile(config);
    this.log(messages.getMessage('log.importData'));
    return this.splitByChunks(results.objectName, results.importfile, results.externalField );
  }

  /**
   * @description Retrieve Object fields
   */
  private async getObjectDescribe(objectname: string): Promise<{fields: string[]; recordTypes: any}> {
    try {
      const obj = this.connection!.sobject(objectname);
      const meta = await obj.describe();
      const fields: string[] = [];
      meta.fields.forEach( (f) => {
        if (f.createable || f.updateable || f.name === 'Id'){
          fields.push(f.name);
        }
      });
      const recordTypes: any = {};
      meta.recordTypeInfos.forEach( (rt) => {
        recordTypes[rt.name] = rt.recordTypeId;
      });
      return {fields,recordTypes};
    } catch (err) {
      const e = err as Error;
      throw messages.createError('error.unexpected', [e.message], undefined, e, e);
    }
  }
  /**
   *
   * @param objectname
   * @param filename
   * @param outputfile
   * @param fields
   */
  private initFile(config: GenericObject): GenericObject {
    // define headers
    const headers: Header[] = [];
    const rowHeaders: string[] = [];

    config.fields.forEach((key: string) => {
      key = key.trim().toLowerCase();
      rowHeaders.push(key);
      if (key === 'recordtype.developername'){    // replace RecordType.DeveloperName column by recordtypeid
        headers.push({id: 'recordtypeid', title: 'recordtypeid'});
      }else{
        headers.push({id: key, title: key});
      }
    });
    // init out file
    fs.writeFileSync(config.importfile,'');
    const csvWriter = createCsvWriter({
      path: config.importfile,
      header: headers,
      append: true,
      encoding:'utf-8'
    });
    // start data masking
    let isHeader = true;
    return fs.createReadStream(config.filepath)  // read data source
    .pipe(csv(rowHeaders))
    .on('data', (row) => {
      const rec: GenericObject = {};
      rowHeaders.forEach( (f) => {
        if (f === 'recordtype.developername'){
          const rt = row[f];      // get developer name of the RT
          if (!isHeader)
          rec['recordtypeid'] = this.objectdescribes[config.objectName].recordTypes[rt]; // set with RT id  with target env
          else    // because first line is the header.
          rec['recordtypeid'] = 'recordtypeid';
        }else{
          rec[f] = row[f];
        }
      });
      void csvWriter.writeRecords([rec]);
      if (isHeader){
        isHeader = false;
      }
    })
    .on('end', () => config);
  }

  private async splitByChunks(objectName: string, filename: string, externalIdField = 'Id'): Promise<void>{
    try {
      const csvSplitResponse: GenericObject = await csvSplitStream.split(
        fs.createReadStream(filename),
        { lineLimit: 10000 },
        (index: number) => fs.createWriteStream(filename.split('.csv').join(index+'.csv'))
        );

        fs.unlinkSync(filename);
        const upsertPromises: Array<Promise<BatchResult>> = [];
        for (let i = 0; i < csvSplitResponse.totalChunks; i++){
          this.log(messages.getMessage('log.batch',[i+1, csvSplitResponse.totalChunks]));
          const fn = filename.split('.csv').join(i+'.csv');
          upsertPromises.push(this.upsertRecords(objectName, fn , externalIdField));
        }
        await Promise.all(upsertPromises);
      } catch(csvSplitError) {
        throw messages.createError('error.splitStream', [(csvSplitError as Error).toString()]);
      }
    }

    private async upsertRecords(objectName: string, filename: string, externalIdField = 'Id'): Promise<BatchResult>{
      try {
        const csvFileIn: fs.ReadStream = fs.createReadStream(filename);
        const rets = await this.connection!.bulk.load(objectName, 'upsert', {extIdField:externalIdField}, csvFileIn);
        const results: BatchResult = {
          success : [],
          errors : []
        }
        for (const elem of rets) {
          if (elem.success) {
            results.success.push(elem);
          } else {
            results.errors.push(elem);
            if (results.errors.length <= 5 ) {
              this.log('    ', elem.errors.join(', '));
            }
          }
        }
        this.log(messages.getMessage('log.loadResult', [`\x1b[32m${results.success.length}\x1b[0m`,`\x1b[31m${results.errors.length}\x1b[0m`]));
        fs.unlinkSync(filename);
        return results;
      } catch (e) {
        this.error((e as Error).message);
      }
    }
  }