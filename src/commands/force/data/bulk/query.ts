
import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError,Connection} from '@salesforce/core';
import * as fs from 'fs';
import { resolve } from 'url';

export default class BulkExport extends SfdxCommand {

    public static description = 'Export salesforce data using bulk api';
  
    public static examples = [
    `$ deloitte force:data:bulk:query -q "select id from Account" -u dev2`,
    `$ deloitte force:data:bulk:query -q "select id from Account" -u dev2 -d ./dataoutputdir -i 10000`,
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        objectname: flags.string({char:'o', description: 'object name'}),  
        query: flags.string({char:'q', description: 'soql query'}),
        allfields: flags.boolean({default:false, description: 'retrieve all fields from specified object.'}),  
        outputdir: flags.string({char:'d', description: 'bulk data output directory', default : 'bulk_output'}),
        filename: flags.string({char:'f', description: 'name of the csv file generated. if not specified, it will default to "<objeectname>_<timestamp>.csv"'})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;

    protected fields:string[] = [];
    protected query:string;
    protected objectname:string;
    protected connection:Connection;
    protected outputdir:string;
  
    public async run() {
        this.outputdir   = this.flags.outputdir;
        this.query  = this.flags.query;
        this.objectname  = this.flags.objectname;
        //do we have a proper connections ? 
        this.connection = this.org.getConnection();
        if (!this.connection || !this.connection.accessToken || !this.connection.instanceUrl){
            throw new SfdxError(`No configuration found for this org.`, "Invalid Connection");
        }
        //handle query
        if (!this.query && !this.objectname){ //invalid arguments
          throw new SfdxError("You must use either --query or --objectname.", "Invalid Flags");
        }else if (this.query){ 
          this.objectname = this.query.toUpperCase().replace(/\([\s\S]+\)/g, '').match(/FROM\s+(\w+)/i)[1];
          if (!this.objectname) {
            throw new SfdxError("No sobject type found in query, maybe caused by invalid SOQL.", "Invalid SOQL");
          }
          const fieldSelector = this.query.replace(/\([\s\S]+\)/g, '').match(/SELECT(.*?)FROM/i)[1].trim();
          if (fieldSelector === '*'){
            this.fields = await this.getObjectFields();
            this.query = this.query.replace('*',this.fields.join(','));
          }
        }else if (this.objectname){
          this.query = await this.generateQuery(this.org.getConnection(), this.flags.allfields);
        }

        let filename = this.flags.filename || (this.objectname + '.csv');
        var outputFile = `${this.outputdir}/${filename}`;

        this.ux.startSpinner('Processing...');
        var result = await this.execute(outputFile);
        this.ux.stopSpinner('Done');
        console.log(result);
        return { outputFile};
    }
    /**
     * @description Build soql query for selected object
     */
    private async generateQuery(connection, allfields){
        let soql = ['SELECT'];
        if (allfields){
          this.fields = await this.getObjectFields();
        }else{
          this.fields.push('Id');
        }
        soql.push(this.fields.join(","));
        soql.push('FROM');
        soql.push(this.objectname);
        return soql.join(" ");
    }
    /**
     * @description Create bulk job
     */
    private async execute(outputFile):Promise<string>{
      return new Promise((resolve, reject) => {
        var csvFileOut = fs.createWriteStream(outputFile);
        this.connection.bulk.query(this.query)
        .stream() // Convert to Node.js's usual readable stream.
        .pipe(csvFileOut)
        .on('end',() => {
          resolve('success');
        });
      });
    }
    /**
     * @description Retrieve Object fields 
     */
    private async getObjectFields():Promise<string[]>{
      return new Promise((resolve, reject) => {
        this.connection.sobject(this.objectname).describe(function(err, meta) {
          if (err) { reject(err); }
          let t:string[] = [];
          meta.fields.forEach( (f) => {
            if (f.type !== 'address' && !f.calculated){
              t.push(f.name);
            }
          });
          resolve(t);
        });
      });
    }
}
