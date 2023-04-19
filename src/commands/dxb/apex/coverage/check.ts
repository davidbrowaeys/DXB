import { flags, SfdxCommand } from '@salesforce/command';
import * as fs from 'fs';
import { SfdxError } from '@salesforce/core';
import * as xml2js from 'xml2js';

const SUCCESS_MESSAGE:string = 'Code coverage is looking good!';
const ERROR_MESSAGE:string = 'Insufficient Code Coverage!';
export default class CoverageCheck extends SfdxCommand {

    public static description = 'This method read cobertura xml file and check if any class coverage is below the minumum threshold. ';

    public static examples = [
        `$ sfdx dxb:apex:coverage:check -f tests/coverage/cobertura.xml`,
        `$ sfdx dxb:apex:coverage:check -f tests/coverage/cobertura.xml -c 99`
    ];

    public static args = [{ name: 'file' }];

    protected static flagsConfig = {
        filepath: flags.string({ char: 'f', description: 'Path of junit file', required: true }),
        mincoverage: flags.number({ char: 'c', description: 'Minimum apex coverage in %', default: 95})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = false;

    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;

    public async run() {
        const filePath:string = this.flags.filepath;
        const threshold:number = parseFloat(this.flags.mincoverage) / 100;
        var data = fs.readFileSync(filePath,{encoding: 'utf-8'}); 
        if (!fs.existsSync(filePath)) {
            throw new SfdxError('Coverage file not found: '+ filePath);
        }
        xml2js.parseString(data, function (err, result) {
            if (err){
                console.error(err);
            }else if (result){
                let badClasses = [];
                result.coverage.packages[0].package[0].classes[0].class.forEach( apex => {
                    if (parseFloat(apex.$['line-rate']) < threshold){
                        badClasses.push(apex);
                    }
                });
                if (badClasses && badClasses.length >= 1 ){
                    console.log('Ooops, coverage seems a bit low! Each apex class is expected at least a coverage of '+threshold*100+'%.');
                    result = [];
                    badClasses.forEach((item) => {
                        const coverage:number = parseFloat(item.$['line-rate']);
                        result.push({
                            name: item.$.name, 
                            path: item.$.filename,
                            Time: `${item.$['line-rate'] * 100}%`, 
                            Diff: `-${((threshold - coverage) * 100).toFixed(2)}%`
                        });
                    });
                    console.table(result);
                    throw new SfdxError(ERROR_MESSAGE);
                }else{
                    console.log(SUCCESS_MESSAGE);
                }
            }
        });
    }
    
}