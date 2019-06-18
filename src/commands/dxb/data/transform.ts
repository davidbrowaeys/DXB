
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';

const fs = require('fs');
const csv = require('fast-csv');
const exec = require('child_process').execSync;
const csvp = require('csv-parser'); 
const createCsvWriter = require('csv-writer').createObjectCsvWriter; 


export default class DataTransform extends SfdxCommand {

    public static description = 'Create fieldset for specified object and push to scratch org.';
  
    public static examples = [
        `$ sfdx dxb:data:transform -u sit -o Account -q "select id from Account where Phone_Country__c = 'Australia' limit 10"`
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        query: flags.string({char:'q',description:'query',required:true}),
        objectname: flags.string({char: 'o',description: 'Object Name'}),
        transform: flags.string({char: 't',description: 'transforming mapping, i.e.: "{\"Phone_Country__pc\":\"Australia_61\",\"Mobile_Country__pc\":\"Australia_61\",\"Home_Phone_Country__pc\":\"Australia_61\"}"'})
        //retrievefields: flags.boolean({char: 'f',description: 'retrieve and display sobject fields in terminal'})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;
  
    public async run() {
        let orgname = this.org.getUsername();
        let sobject = this.flags.objectname;
        let transform = this.flags.transform;
        let query = this.flags.query;

        console.log(`sfdx force:data:soql:query -q "${query}" --json -u ${orgname}`);
        //var output = JSON.parse(exec(`sfdx force:data:soql:query -q "${query}" --json -u ${orgname}`).toString());
        exec(`sfdx force:data:soql:query -q "${query}" -r csv -u ${orgname} > ${sobject}_in.csv `);

        transform = JSON.parse(transform);

        // const record = [
        //     {id: "Id",  phone_country__c: "Phone_Country__c"}
        // ];

        var record = [{id:'Id'}];
        var headers = [{id: 'id', title: 'Id'}];
        Object.keys(transform).forEach(function(key) {
            record[0][key] = key;
            headers.push({id: key, title: key});
        });
        console.log(record);

        const csvWriter = createCsvWriter({  
            path: `${sobject}_out.csv`,
            header: headers,
            append: true
          });
        csvWriter.writeRecords(record);

        fs.createReadStream(`${sobject}_in.csv`)  
        .pipe(csvp())
        .on('data', (row) => 
        {
            //console.log(row["Id"]);
            // var record = [
            //     {id: row["Id"],  phone_country__c: "Australia_61"}
            // ];
            var record = [{id: row["Id"]}];
            Object.keys(transform).forEach(function(key) {
                record[0][key] = transform[key];
            });
            csvWriter.writeRecords(record);
        })
        .on('end', () => {
            console.log('CSV file successfully processed');
        });
    }
}
