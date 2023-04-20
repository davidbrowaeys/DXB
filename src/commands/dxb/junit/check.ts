import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError } from '@salesforce/core';
import * as fs from 'fs';
import * as xml2js from 'xml2js';

export const CONSOLE_COLORS = {
    blue: '\x1b[34m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    white: '\x1b[37m',
    yellow: '\x1b[33m',
};

export default class JUnitReview extends SfdxCommand {

    public static description = 'This command check quality of the junit and flag anything slower than defined threshold';

    public static examples = [
        `$ sfdx dxb:junit:check -p tests/junit.xml`
    ];

    public static args = [{ name: 'file' }];

    protected static flagsConfig = {
        junitpath: flags.string({ char: 'p', description: 'Path of junit xml file', required:true }),
        timethreshold: flags.number({ char: 't', description: 'maximum amount of time that a test method should take to execute (in second).', default: 1}),
        flagaserror: flags.boolean({ char: 'e', description: 'if set, the command will update add failure tags to junit file and throw an error', default: false})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = false;s

    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;

    public async run() {
        const junitpath = this.flags.junitpath;
        const threshold:number = parseFloat(this.flags.timethreshold);
        const flagaserror = this.flags.flagaserror;
        this.readJunit(junitpath,threshold,flagaserror);
    }
    /**
     * Parses a JUnit XML file and modifies it to include failure information for slow tests.
     * @param junitPath - The file path of the JUnit XML file to be parsed.
     * @param threshold - The time threshold (in milliseconds) to consider a test method "slow".
     * @throws SfdxError - If the JUnit file is not found.
     */
    private readJunit(junitPath: string, threshold: number, flagaserror: boolean): void {
        if (!fs.existsSync(junitPath)) {
            throw new SfdxError(`JUnit file not found: ${junitPath}`);
        }

        const data = fs.readFileSync(junitPath, { encoding: 'utf-8' });
        xml2js.parseString(data, (err: any, result: any) => {
            if (err) {
                console.error(err);
                return;
            }
            
            let numSlowTests = 0;
            let slowTests = [];
            result.testsuites.testsuite.forEach((ts: any) => {
                ts.testcase.forEach((testcase: any) => {
                    const time = parseFloat(testcase.$.time);
                    
                    if (!testcase.failure && time >= threshold) {
                        numSlowTests++;
                        if (numSlowTests === 1) console.log(`${CONSOLE_COLORS.yellow}%s\x1b[0m`, `Some unit test have been idenfitied below our standard ${threshold}s:`);
                        slowTests.push({
                            ClassName: testcase.$.classname,
                            TestName: testcase.$.name,
                            time: time, 
                            Diff: `+${time - threshold}s`
                        });
                        if (flagaserror){
                            testcase.failure = {
                                '_': `Class.${testcase.$.classname}.${testcase.$.name}: line 0, column 0`,
                                '$': {
                                    'message': 'DXB.PerformanceException: Test method seems a bit slow'
                                }
                            };
                        }
                    }
                });
            });

            if (slowTests.length > 0){
                console.table(slowTests);
            }

            if (numSlowTests > 0&& flagaserror) {
                const builder = new xml2js.Builder({ cdata: true });
                const xml = builder.buildObject(result);
                fs.writeFileSync(junitPath, xml);
                throw new SfdxError('DXB.PerformanceException');
            }
        });
    }
}