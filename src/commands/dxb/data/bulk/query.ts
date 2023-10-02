import * as fs from 'fs-extra';
import {Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { SfError,Connection, Messages} from '@salesforce/core';
type BulkExportResult = {
  outputFile: string;
}

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'data.bulk.query');
export default class BulkExport extends SfCommand<BulkExportResult> {

  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples')

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'object-name': Flags.string({char:'s', summary: messages.getMessage('flags.object-name.summary')}),
    query: Flags.string({char:'q', summary: messages.getMessage('flags.query.summary')}),
    'all-fields': Flags.boolean({default:false, summary: messages.getMessage('flags.all-fields.summary')}),
    'output-dir': Flags.string({char:'d', summary: messages.getMessage('flags.output-dir.summary'), default : 'bulk_output'}),
    'file-name': Flags.string({char:'f', summary: messages.getMessage('flags.file-name.summary')})
  };

  protected fields: string[] = [];
  protected query: string | undefined;
  protected objectname: string | undefined;
  protected connection: Connection | undefined;
  protected outputdir: string | undefined;

  public async run(): Promise<BulkExportResult> {
    const {flags} = await this.parse(BulkExport);
    this.outputdir   = flags['output-dir'];
    this.query  = flags.query;
    this.objectname  = flags['object-name'];
    // do we have a proper connections ?
    this.connection = flags['target-org']?.getConnection();
    if (!this.connection?.accessToken || !this.connection.instanceUrl){
      throw new SfError(messages.getMessage('error.message.noConfiguration'), messages.getMessage('error.name.invalidConnection'));
    }
    // handle query
    if (!this.query && !this.objectname) { // invalid arguments
      throw new SfError(messages.getMessage('error.message.queryOrObject'), messages.getMessage('error.name.invalidFlags'));
    } else if (this.query) {
      this.objectname = this.query.toUpperCase().replace(/\([\s\S]+\)/g, '').match(/FROM\s+(\w+)/i)![1];
      if (!this.objectname) {
        throw new SfError(messages.getMessage('error.message.invalidSOQL'), messages.getMessage('error.name.invalidSOQL'));
      }
      const fieldSelector = this.query.replace(/\([\s\S]+\)/g, '').match(/SELECT(.*?)FROM/i)![1].trim();
      if (fieldSelector === '*') {
        this.fields = await this.getObjectFields();
        this.query = this.query.replace('*',this.fields.join(','));
      }
    } else if (this.objectname) {
      this.query = await this.generateQuery(flags.allfields);
    }

    const filename = flags.filename ?? (this.objectname + '.csv');
    const outputFile = `${this.outputdir}/${filename}`;

    this.spinner.start('Processing...');
    const result = await this.execute(outputFile);
    this.spinner.stop('Done');
    this.log(result);
    return { outputFile };
  }

  /**
   * @description Build soql query for selected object
   */
  private async generateQuery(allfields: boolean): Promise<string> {
    const soql = ['SELECT'];
    if (allfields){
      this.fields = await this.getObjectFields();
    } else{
      this.fields.push('Id');
    }
    soql.push(this.fields.join(','));
    soql.push('FROM');
    soql.push(this.objectname!);
    return soql.join(' ');
  }

  /**
   * @description Create bulk job
   */
  private async execute(outputFile: string): Promise<string>{
    return new Promise((resolve, reject) => {
      try {
        const csvFileOut = fs.createWriteStream(outputFile);
        this.connection!.bulk.query(this.query!)
        .stream() // Convert to Node.js's usual readable stream.
        .pipe(csvFileOut)
        .on('end',() => {
          resolve('success');
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * @description Retrieve Object fields
   */
  private async getObjectFields(): Promise<string[]>{
    return new Promise((resolve, reject) => {
      this.connection!.sobject(this.objectname!).describe()
      .then(meta => {
        const t: string[] = [];
        meta.fields.forEach( (f) => {
          if (f.type !== 'address' && !f.calculated){
            t.push(f.name);
          }
        });
        resolve(t);
      })
      .catch(err => {
        reject(err)
      });
    });
  }
}
