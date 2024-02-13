import * as fs from 'fs-extra';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import * as xml2js from 'xml2js';

const CONSOLE_COLORS = {
  blue: '\x1b[34m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  yellow: '\x1b[33m',
};
type Test = {
  ClassName: string;
  TestName: string;
  time: number;
  Diff: string;
};

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'junit.check');

export type JunitCheckResult = {
  success: boolean;
};

export default class JunitCheck extends SfCommand<JunitCheckResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = ['$ sfdx dxb:junit:check '];

  public static readonly flags = {
    'junit-path': Flags.file({
      char: 'p',
      summary: messages.getMessage('flags.junit-path.summary'),
      required: true,
      exists: true,
      aliases: ['junitpath'],
      deprecateAliases: true,
    }),
    'time-threshold': Flags.string({
      char: 't',
      summary: messages.getMessage('flags.time-threshold.summary'),
      default: '1',
      aliases: ['timetreshold'],
      deprecateAliases: true,
    }),
    'flag-as-error': Flags.boolean({
      char: 'e',
      summary: messages.getMessage('flags.flag-as-error.summary'),
      default: false,
      aliases: ['flagaserror'],
      deprecateAliases: true,
    }),
  };

  public async run(): Promise<JunitCheckResult> {
    const { flags } = await this.parse(JunitCheck);
    const junitpath = flags['junit-path'];
    const threshold = Number(flags['time-threshold']);
    const flagaserror = flags['flag-as-error'];
    await this.readJunit(junitpath, threshold, flagaserror);
    return { success: true };
  }
  /**
   * Parses a JUnit XML file and modifies it to include failure information for slow tests.
   *
   * @param junitPath - The file path of the JUnit XML file to be parsed.
   * @param threshold - The time threshold (in milliseconds) to consider a test method "slow".
   * @throws SfError - If the JUnit file is not found.
   */
  // eslint-disable-next-line class-methods-use-this
  private async readJunit(junitPath: string, threshold: number, flagaserror: boolean): Promise<void> {
    const data = fs.readFileSync(junitPath, { encoding: 'utf-8' });
    const result: any = await xml2js.parseStringPromise(data);

    let numSlowTests = 0;
    const slowTests: Test[] = [];
    result.testsuites.testsuite.forEach((ts: any) => {
      ts.testcase.forEach((testcase: any) => {
        const time = parseFloat(testcase.$.time);

        if (!testcase.failure && time >= threshold) {
          numSlowTests++;
          if (numSlowTests === 1) {
            this.log(`${CONSOLE_COLORS.yellow}%s\x1b[0m`, messages.getMessage('log.slowUnitTest', [threshold]));
          }
          slowTests.push({
            ClassName: testcase.$.classname,
            TestName: testcase.$.name,
            time,
            Diff: `+${time - threshold}s`,
          });
          if (flagaserror) {
            testcase.failure = {
              _: `Class.${testcase.$.classname as string}.${testcase.$.name as string}: line 0, column 0`,
              $: {
                message: messages.getMessage('error.performance.tooSlow'),
              },
            };
          }
        }
      });
    });

    if (slowTests.length > 0) {
      this.table(slowTests, {
        ClassName: { header: 'CLASSNAME' },
        TestName: { header: 'TESTNAME' },
        time: { header: 'TIME' },
        Diff: { header: 'DIFF' },
      });
    }

    if (numSlowTests > 0 && flagaserror) {
      const builder = new xml2js.Builder({ cdata: true });
      const xml = builder.buildObject(result);
      fs.writeFileSync(junitPath, xml);
      throw messages.createError('error.performance');
    }
  }
}
