import * as path from 'path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import * as fs from 'fs-extra';
import * as csvpModule from 'csv-parser';
const csvp = csvpModule.default;
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import { BulkIngestBatchResult } from 'jsforce/lib/api/bulk';
import { Connection, DescribeSObjectResult } from 'jsforce';

type Header = {
  id: string;
  title: string;
};
type GenericObject = {
  [key: string]: any;
};
export type DataRestoreResult = {
  success: boolean;
};
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'data.restore');
export default class DataRestore extends SfCommand<DataRestoreResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'backup-dir': Flags.directory({
      char: 'f',
      summary: messages.getMessage('flags.backup-dir.summary'),
      required: true,
      exists: true,
      aliases: ['backupdir'],
      deprecateAliases: true,
    }),
  };

  protected connection: Connection | undefined;
  protected setting: any;
  protected backupdir: string | undefined;

  public async run(): Promise<DataRestoreResult> {
    try {
      const { flags } = await this.parse(DataRestore);
      this.connection = flags['target-org']?.getConnection();
      this.backupdir = flags['backup-dir'];
      this.config = JSON.parse(fs.readFileSync(path.join(this.backupdir, 'full/log.json')).toString());

      await this.restoreFull();
      return { success: true };
    } catch (e) {
      const err: Error = e as Error;
      throw messages.createError('error.unexpected', [err.message], undefined, err, err);
    }
  }

  private async restoreFull(): Promise<void[]> {
    const files = fs.readdirSync(path.join(this.backupdir ?? '', 'full'));
    return Promise.all(
      files.map(async (f: string) => {
        if (f.endsWith('.csv')) {
          await this.processFile(path.join(this.backupdir ?? '', 'full'), f);
        }
      })
    );
  }

  private async processFile(filepath: string, file: string): Promise<BulkIngestBatchResult> {
    this.log('Step 1');
    const object = file.split('.')[0];
    const outputfile = path.join(this.backupdir ?? '', `${object}_out.csv`);
    const fields = await this.getSupportedObjectFields(object);
    this.styledJSON({ fields, object, file, filepath, outputfile });

    this.log('Step 2');
    this.prepareImportFile(path.join(filepath, file), outputfile, fields);

    this.log('Step 3');
    const records = await this.upsertRecords(object, outputfile);
    return records;
  }

  private async upsertRecords(
    object: string,
    filename: string,
    externalIdField = 'Id'
  ): Promise<BulkIngestBatchResult> {
    this.log(object, filename);
    const csvFileIn: any = fs.createReadStream(filename);
    const rets = (await this.connection?.bulk.load(object, 'upsert', { extIdField: externalIdField }, csvFileIn)) ?? [];
    for (let i = 0; i < rets.length; i++) {
      if (rets[i].success) {
        this.log(messages.getMessage('log.loadSuccessful', [i + 1, rets[i].id]));
      } else {
        this.log(messages.getMessage('log.loadFailed', [i + 1, rets[i].errors.join(', ')]));
      }
    }
    return rets;
  }

  /**
   * @description Retrieve Object fields
   */
  private async getSupportedObjectFields(objectname: string): Promise<string[]> {
    const meta: DescribeSObjectResult | undefined = await this.connection?.sobject(objectname).describe();
    const supportedFields: string[] = [];
    meta?.fields.forEach((f) => {
      if (f.createable || f.updateable || f.name === 'Id') {
        supportedFields.push(f.name);
      }
    });
    return supportedFields;
  }

  private prepareImportFile(filename: string, outputfile: string, fields: string[]): void {
    // define headers
    const rowHeaders: Array<{ [key: string]: any }> = [{}];
    const headers: Header[] = [];
    fields.forEach((key) => {
      rowHeaders[0][key] = key;
      headers.push({ id: key, title: key });
    });
    // init out file
    fs.writeFileSync(outputfile, '');
    const csvWriter = createCsvWriter({
      path: outputfile,
      header: headers,
      append: true,
      encoding: 'utf8',
    });
    void csvWriter.writeRecords(rowHeaders);
    // start data masking
    this.spinner.start('Preparing file import...');
    fs.createReadStream(filename) // read data source
      .pipe(csvp())
      .on('data', (row) => {
        const record: GenericObject = {};
        for (const s of fields) {
          record[s] = row[s];
        }
        void csvWriter.writeRecords([record]);
      })
      .on('end', () => {
        // fs.unlinkSync(filename);
        // fs.renameSync(`${objectname}_out.csv`,,filename);
        this.spinner.stop('Done');
      });
  }
}

/* ***** SCENARIOS
|SP|
Full            D1          D2         D3
 ---------------------------------------------------------->
X               X           X           X                       N/A
X               X           X           V                       UPSERT
X               X           V           V                       UPSERT
X               V           V           V                       UPSERT
V               V           V           V                       UPSERT
 
X               V           V           X                       DELETE?
 
V               V           V           X                       DELETE?
V               V           X           X                       DELETE?
V               X           X           X                       DELETE?
V               X           V           V                       UPSERT
 */
