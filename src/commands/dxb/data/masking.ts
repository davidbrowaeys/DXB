
import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError } from '@salesforce/core';
import * as fs from 'fs';
import * as csvp from 'csv-parser';
import {createObjectCsvWriter as createCsvWriter} from 'csv-writer';


export default class DataMasking extends SfdxCommand {

    public static description = 'Create fieldset for specified object and push to scratch org.';
  
    public static examples = [
        `sfdx dxb:data:bulk:query -u devhub -q "select id from Account"
        sfdx dxb:data:masking -f config/data-masking-def.json -o Account -s bulk_output/ACCOUNT.csv
        sfdx force:data:bulk:upsert -s Account -f bulk_output/ACCOUNT.csv -i Id -w 600 -u devhub
        `
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        definitionfile: flags.string({char:'f',description:'path to a data masking definition file',required:true}),
        sourcedata: flags.string({char:'s',description:'path to a data source file',required:true}),
        objectname: flags.string({char: 'o',description: 'Object Name',required:true})
        //retrievefields: flags.boolean({char: 'f',description: 'retrieve and display sobject fields in terminal'})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = false;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;
  
    public async run() {
        let sourcedata = this.flags.sourcedata;
        let configFile = this.flags.definitionfile;
        if (!fs.existsSync(configFile)){
            throw new SfdxError('Data masking definition file not found.');
        }
        let config = JSON.parse(fs.readFileSync(configFile).toString());
        let sobject = this.flags.objectname;
        if (!config[sobject]){
            throw new SfdxError('Data masking definition not found for this object.');
        }
        this.ux.log('\nInitializing process...\n');
        config = config[sobject];
        //define headers
        var rowHeaders = [{id:'id'}];
        var headers = [{id: 'id', title: 'Id'}];
        Object.keys(config).forEach(function(key) {
            rowHeaders[0][key] = key;
            headers.push({id: key, title: key});
        });
        //init out file
        fs.writeFileSync(`transformed_tmp.csv`, "");
        const csvWriter = createCsvWriter({  
            path: `transformed_tmp.csv`,
            header: headers,
            append: true
          });
        csvWriter.writeRecords(rowHeaders);
        //start data masking
        this.ux.startSpinner('Masking data...');
        fs.createReadStream(sourcedata)  //read data source
            .pipe(csvp())
            .on('data', (row) => {
                var record = {id: row["Id"]};
                this.transform(record,config);
                csvWriter.writeRecords([record]);
            })
            .on('end', () => {
                fs.unlinkSync(sourcedata);
                fs.renameSync(`transformed_tmp.csv`,sourcedata);
                this.ux.stopSpinner('\n\nData masked successfully!\n');
            });
    }
    /**
     * Apply transformation logic.
     * @param record record to transform
     * @param fieldValues mapping to apply 
     */
    public transform(record, fieldValues){
        Object.keys(fieldValues).forEach((fieldName) => {
            let value:any = fieldValues[fieldName];
            if (value && value === 'email'){
                value = this.generateRandomString(10) + 'test.co';
            }else if (value === 'phone'){
                value = '0'+ this.generateNDigitsNumber(9);
            }else if (value && value == 'date'){
                if (record[fieldName] !== null){
                    value = Date.parse(record[fieldName]);
                    var  days = this.generateRandomNumber(1, 200);  //generate random number of days (1, 999)
                    value.setDate(value.getDate() + days);
                }
            }else if (value && value === 'name'){ //generate random string
                if (value.indexOf('::') >= 0){
                    var len = value.split('::')[1];
                    value = this.generateRandomString(10);
                }else{
                    value = this.generateRandomString(10);
                }
            }else if (value && value === 'street'){
                value = this.generateNDigitsNumber(3) +' '+ this.generateRandomString(20) + ' Street';
                record[fieldName] = value;
            }else if (value && value.indexOf('num') >= 0){
                if (value.indexOf('::') >= 0){
                    var len = value.split('::')[1];
                    value = this.generateNDigitsNumber(len);
                }else{
                    value = this.generateRandomNumber(1,100000);
                }
                if (fieldValues[fieldName] && fieldValues[fieldName].indexOf('num_str') >= 0){ //render as a string
                    value = ""+value;
                }
            }
            record[fieldName] = value;
        });
    }
    /**
     * Generate random number of 'n' digits
     * @param n number of digits
     */
    private generateNDigitsNumber(n):number {
        let min = Math.pow(10,n-1);
        let max = Math.pow(10,n) - 1;
        return this.generateRandomNumber(min,max);
	}
    /**
     * Generate random number between min and max
     * @param min lowest number
     * @param max highest number
     */
    private generateRandomNumber(min,max):number {
        return Math.floor(Math.random()*(max-min+1)+min);
	}
    /**
     * Generate random string using a-z and A-Z.
     * @param len length of the string to generate
     */
	private generateRandomString(len) {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
		let result:any = []
		let idx = 0;

		while(idx < len) {
            let chr:number = this.generateRandomNumber(0,51);
            result.push(chars.substring(chr, chr+1));
            idx++;
		}
		return result.join('');
	}
}
