import * as fs from 'fs-extra';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import * as csvp from 'csv-parser';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import { Messages } from '@salesforce/core';
import { isString } from '@salesforce/ts-types';

type GenericObject = {
  [key: string]: any;
};
export type DataMaskingResult = {
  success: boolean;
};
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'data.masking');

export default class DataMasking extends SfCommand<DataMaskingResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'definition-file': Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.definition-file.summary'),
      required: true,
      exists: true,
    }),
    'source-data': Flags.file({
      char: 'd',
      summary: messages.getMessage('flags.source-data.summary'),
      required: true,
      exists: true,
    }),
    'object-name': Flags.string({
      char: 's',
      summary: messages.getMessage('flags.object-name.summary'),
      required: true,
    }),
  };

  public async run(): Promise<DataMaskingResult> {
    const { flags } = await this.parse(DataMasking);
    const sourcedata = flags['source-data'];
    const configFile = flags['definition-file'];

    let config = JSON.parse(fs.readFileSync(configFile).toString());
    const sobject = flags['object-name'];
    if (!config[sobject]) {
      throw messages.createError('error.objectNotFound');
    }
    this.log(messages.getMessage('log.initializingProcess'));
    config = config[sobject];
    // define headers
    const rowHeaders: Array<{ [key: string]: any }> = [{ id: 'id' }];
    const headers = [{ id: 'id', title: 'Id' }];
    Object.keys(config).forEach((key: string) => {
      rowHeaders[0][key] = key;
      headers.push({ id: key, title: key });
    });
    // init out file
    fs.writeFileSync('transformed_tmp.csv', '');
    const csvWriter = createCsvWriter({
      path: 'transformed_tmp.csv',
      header: headers,
      append: true,
    });
    await csvWriter.writeRecords(rowHeaders);
    // start data masking
    this.spinner.start('Masking data...');
    fs.createReadStream(sourcedata) // read data source
      .pipe(csvp())
      .on('data', (row) => {
        const record = { id: row['Id'] };
        this.transform(record, config);
        void csvWriter.writeRecords([record]);
      })
      .on('end', () => {
        fs.unlinkSync(sourcedata);
        fs.renameSync('transformed_tmp.csv', sourcedata);
        this.spinner.stop('\n\nData masked successfully!\n');
      });
    return { success: true };
  }
  /**
   * Apply transformation logic.
   *
   * @param record record to transform
   * @param fieldValues mapping to apply
   */
  public transform(record: GenericObject, fieldValues: GenericObject): void {
    Object.keys(fieldValues).forEach((fieldName) => {
      let value: string | number | Date = fieldValues[fieldName];
      if (value === 'email') {
        value = this.generateRandomString(10) + 'test.co';
      } else if (value === 'phone') {
        value = `0${this.generateNDigitsNumber(9)}`;
      } else if (value === 'date') {
        if (record[fieldName] !== null) {
          value = new Date(Date.parse(value));
          const days = this.generateRandomNumber(1, 200); // generate random number of days (1, 999)
          value.setDate(value.getDate() + days);
        }
      } else if (value === 'name') {
        // generate random string
        value = this.generateRandomString(10);
      } else if (value === 'street') {
        value = `${this.generateNDigitsNumber(3)} ${this.generateRandomString(20)} Street`;
        record[fieldName] = value;
      } else if (isString(value) && value.includes('num')) {
        if (value.includes('::')) {
          const len = parseInt(value.split('::')[1], 10);
          value = this.generateNDigitsNumber(len);
        } else {
          value = this.generateRandomNumber(1, 100000);
        }
        if (fieldValues[fieldName] && fieldValues[fieldName].indexOf('num_str') >= 0) {
          // render as a string
          value = `${value}`;
        }
      }
      record[fieldName] = value;
    });
  }
  /**
   * Generate random number of 'n' digits
   *
   * @param n number of digits
   */
  private generateNDigitsNumber(n: number): number {
    const min = Math.pow(10, n - 1);
    const max = Math.pow(10, n) - 1;
    return this.generateRandomNumber(min, max);
  }
  /**
   * Generate random number between min and max
   *
   * @param min lowest number
   * @param max highest number
   */
  // eslint-disable-next-line class-methods-use-this
  private generateRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
  /**
   * Generate random string using a-z and A-Z.
   *
   * @param len length of the string to generate
   */
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private generateRandomString(len: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const result: string[] = [];
    let idx = 0;

    while (idx < len) {
      const chr: number = this.generateRandomNumber(0, 51);
      result.push(chars.substring(chr, chr + 1));
      idx++;
    }
    return result.join('');
  }
}
