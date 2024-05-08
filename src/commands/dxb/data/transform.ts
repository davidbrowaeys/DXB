import { execSync as exec } from 'child_process';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { JsonMap } from '@salesforce/ts-types';
import * as fs from 'fs-extra';
import * as csvpModule from 'csv-parser';
const csvp = csvpModule.default;
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import { Messages } from '@salesforce/core';

type Header = {
  id: string;
  title: string;
};
type GenericObject = {
  [key: string]: any;
};
export type DataTransformResult = {
  success: boolean;
};
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'data.transform');
export default class DataTransform extends SfCommand<DataTransformResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    query: Flags.string({ char: 'q', summary: messages.getMessage('flags.query.summary'), required: true }),
    'object-name': Flags.string({
      char: 's',
      summary: messages.getMessage('flags.object-name.summary'),
      required: true,
      aliases: ['objectname'],
      deprecateAliases: true,
    }),
    'transform-file': Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.transform-file.summary'),
      exists: true,
      required: true,
      aliases: ['transform'],
      deprecateAliases: true,
    }),
  };

  public async run(): Promise<DataTransformResult> {
    const { flags } = await this.parse(DataTransform);
    const orgname = flags['target-org']?.getUsername();
    const sobject = flags['object-name'];
    const transform: JsonMap = JSON.parse(fs.readFileSync(flags['transform-file']).toString());
    const query = flags.query;

    this.log(`sf data query --query "${query}" --json --target-org ${orgname}`);
    exec(`sf data query --query "${query}" --result-format csv --target-org ${orgname} > ${sobject}_in.csv `);

    // const record = [
    //     {id: "Id",  phone_country__c: "Phone_Country__c"}
    // ];

    const record: GenericObject[] = [{ id: 'Id' }];
    const headers: Header[] = [{ id: 'id', title: 'Id' }];
    Object.keys(transform).forEach((key) => {
      record[0][key] = key;
      headers.push({ id: key, title: key });
    });
    this.log(record.toString());

    const csvWriter = createCsvWriter({
      path: `${sobject}_out.csv`,
      header: headers,
      append: true,
    });
    await csvWriter.writeRecords(record);

    fs.createReadStream(`${sobject}_in.csv`)
      .pipe(csvp())
      .on('data', (row) => {
        // console.log(row["Id"]);
        // var record = [
        //     {id: row["Id"],  phone_country__c: "Australia_61"}
        // ];
        const r: GenericObject[] = [{ id: row['Id'] }];
        Object.keys(transform).forEach((key) => {
          r[0][key] = transform[key];
        });
        void csvWriter.writeRecords(r);
      })
      .on('end', () => {
        this.log(messages.getMessage('log.success'));
      });
    return { success: true };
  }
}
