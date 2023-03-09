import { flags, SfdxCommand } from '@salesforce/command';
import * as fs from 'fs';
import { SfdxError } from '@salesforce/core';

var xml2js = require('xml2js');

export default class PofileConvert extends SfdxCommand {

    public static description = 'This method read cobertura xml file and check if any apex class coverage is below the minumum coverage. ';

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
                if (badClasses){
                    console.log('Ooops, coverage seems a bit low! Each apex class is expected at least a coverage of '+threshold*100+'%.');
                    badClasses.forEach(elem =>{
                        const coverage:number = parseFloat(elem.$['line-rate']);
                        console.log(`${elem.$.name}: ${elem.$['line-rate'] * 100}% (-${((threshold - coverage) * 100).toFixed(2)}%)`);
                    })
                    throw new SfdxError('Insufficient Code Coverage!');
                }
            }
        });
    }
    
}