import * as path from 'path';
import { execSync as exec } from 'child_process';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Connection, Messages } from '@salesforce/core';
import * as fs from 'fs-extra';
import { DescribeSObjectResult } from 'jsforce';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'data.backup');

export type DataBackupResult = {
  success: boolean;
};

export default class DataBackup extends SfCommand<DataBackupResult> {
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
    mode: Flags.string({ char: 'm', summary: messages.getMessage('flags.mode.summary'), default: 'full' }),
    'output-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.output-dir.summary'),
      default: '.',
      exists: true,
    }),
  };

  protected connection: Connection | undefined;

  public async run(): Promise<DataBackupResult> {
    const { flags } = await this.parse(DataBackup);
    const definitionfile = flags['definition-file'];
    let outputdir = flags['output-dir'];
    const mode = flags.mode;
    const orgname = flags['target-org']?.getUsername() ?? '';
    this.connection = flags['target-org']?.getConnection();
    const allconfig = JSON.parse(fs.readFileSync(definitionfile).toString());
    if (mode !== 'full' && mode !== 'delta') {
      throw messages.createError('error.invalidMode');
    }
    if (!allconfig[orgname]?.[mode]) {
      throw messages.createError('error.noBackupFile', [definitionfile]);
    }
    const config = allconfig[orgname];
    const startTime = new Date();

    if (mode === 'full') {
      // run full mode using bulk api
      config.full.cycle++;
      outputdir = path.join(outputdir, 'cycle-' + (config.full.cycle as string), 'full');
      fs.mkdirSync(outputdir, { recursive: true });
      config.full.objects.forEach((object: string) => {
        this.log(`\nBackup ${object} :`);
        exec(`sf dxb data bulk query -s ${object} -o ${orgname} --all fields -d ${outputdir}`);
      });
      config.full.backupTime = startTime;
      // init first delta
      config.delta.cycle = 0;
      config.delta.backupTime = startTime;
      fs.writeFileSync(path.join(outputdir, 'log.json'), JSON.stringify(config, null, 2));
    } else if (mode === 'delta') {
      // since what savepoint do we want to get delta ?
      const lastDeltaTime: string =
        !config.delta.backupTime || config.delta.delta_type === 'since_full'
          ? config.full.backupTime
          : config.delta.backupTime;

      config.delta.backupTime = startTime;
      config.delta.cycle++;
      // create output dir for delta if doesn't exist.
      outputdir = path.join(
        outputdir,
        'cycle-' + (config.full.cycle as string),
        'delta',
        config.delta.delta_type === 'since_full' ? 1 : config.delta.cycle.toString()
      );
      if (!fs.existsSync(outputdir)) {
        fs.mkdirSync(outputdir, { recursive: true });
      }
      // for each object run query
      config.delta.objects.forEach(async (object: string) => {
        this.log(object);
        // retrieve new and updated records since last delta
        const filename = path.join(outputdir, object + '.csv');
        const query = await this.generateQuery(this.connection, object, true);
        const soql1 = `${query} WHERE LastModifiedDate >= ${lastDeltaTime}`;
        this.log(messages.getMessage('log.deltaFor', [object]));
        this.spinner.start('Processing...');
        await this.queryAll(this.connection, soql1, filename);
        this.spinner.stop('Done');
      });
      fs.writeFileSync(path.join(outputdir, 'log.json'), JSON.stringify(config, null, 2));
    }

    // update definition file
    allconfig[orgname] = config;
    fs.writeFileSync(definitionfile, JSON.stringify(allconfig, null, 2));
    return { success: true };
  }

  private async generateQuery(
    connection: Connection | undefined,
    objectname: string,
    allfields: boolean
  ): Promise<string> {
    const soql = ['SELECT'];
    let fields = [];
    if (allfields) {
      fields = await this.getObjectFields(connection, objectname);
    } else {
      fields.push('Id');
    }
    soql.push(fields.join(','));
    soql.push('FROM');
    soql.push(objectname);
    return soql.join(' ');
  }

  // eslint-disable-next-line class-methods-use-this
  private queryAll(connection: Connection | undefined, soql: string, outputFile: string): Promise<string> {
    return new Promise((resolve) => {
      const csvFileOut = fs.createWriteStream(outputFile);
      connection
        ?.query(soql)
        .stream('csv') // Convert to Node.js's usual readable stream.
        .pipe(csvFileOut)
        .on('end', () => {
          resolve('success');
        });
    });
  }

  /**
   * @description Retrieve Object fields
   */
  // eslint-disable-next-line class-methods-use-this
  private async getObjectFields(connection: Connection | undefined, objectname: string): Promise<string[]> {
    const sobject = connection?.sobject(objectname);
    const meta: DescribeSObjectResult | undefined = await sobject?.describe();
    const objectFields: string[] = [];
    meta?.fields.forEach((f) => {
      if (f.type !== 'address' && !f.calculated) {
        objectFields.push(f.name);
      }
    });
    return objectFields;
  }
}
