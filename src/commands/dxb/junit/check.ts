import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError } from '@salesforce/core';
import * as fs from 'fs';
import * as xml2js from 'xml2js';

export default class JUnitReview extends SfdxCommand {

    public static description = 'This command check quality of the junit and flag anything slower than defined threshold';

    public static examples = [
        `$ sfdx dxb:junit:check -p tests/junit.xml`
    ];

    public static args = [{ name: 'file' }];

    protected static flagsConfig = {
        junitpath: flags.string({ char: 'p', description: 'Path of junit file', required:true }),
        mintime: flags.number({ char: 't', description: 'Minimum time in second', default: 1})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = false;s

    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;

    public async run() {
        const junitpath = this.flags.junitpath;
        const threshold:number = parseFloat(this.flags.mintime);
        this.readJunit(junitpath,threshold);
    }
    /**
     * Parses a JUnit XML file and modifies it to include failure information for slow tests.
     * @param junitPath - The file path of the JUnit XML file to be parsed.
     * @param threshold - The time threshold (in milliseconds) to consider a test method "slow".
     * @throws SfdxError - If the JUnit file is not found.
     */
    private readJunit(junitPath: string, threshold: number): void {
        if (!fs.existsSync(junitPath)) {
            throw new SfdxError(`JUnit file not found: ${junitPath}`);
        }

        const data = fs.readFileSync(junitPath, { encoding: 'utf-8' });
        xml2js.parseString(data, (err: any, result: any) => {
            if (err) {
                console.error(err);
                return;
            }
            
            let totalTime = 0.0;
            let numSlowTests = 0;

            result.testsuites.testsuite.forEach((ts: any) => {
                ts.testcase.forEach((testcase: any) => {
                    const time = parseFloat(testcase.$.time);

                    totalTime += time;
                    
                    if (!testcase.failure && time >= threshold) {
                        numSlowTests++;
                        if (numSlowTests === 1) console.log(`Some unit test have been idenfitied below our standard ${threshold}s:`);
                        console.log(`Class.${testcase.$.classname}.${testcase.$.name}: ${time}s (+${time - threshold}s)`);
                        testcase.failure = {
                            '_': `Class.${testcase.$.classname}.${testcase.$.name}: line 0, column 0`,
                            '$': {
                                'message': 'DXB.PerformanceException: Test method seems a bit slow'
                            }
                        };
                    }
                });
            });

            const numTests = result.testsuites.testsuite.reduce((total: number, ts: any) => total + ts.testcase.length, 0);
            const avgTime = totalTime / numTests;

            if (avgTime >= threshold) {
                console.log(`Overall test classes are experiencing some performance issues. In average we have identified a processing time of ${avgTime}ms per test method which is above our standard threshold of ${threshold}s.`);
            }

            if (numSlowTests > 0) {
                const builder = new xml2js.Builder({ cdata: true });
                const xml = builder.buildObject(result);
                fs.writeFileSync(junitPath, xml);
            }
        });
    }
}