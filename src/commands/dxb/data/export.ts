
import { flags, SfdxCommand } from '@salesforce/command';
import { Connection } from '@salesforce/core';
import * as fs from 'fs';
import * as path from 'path';
import {createObjectCsvWriter as createCsvWriter} from 'csv-writer';


export default class DataTransferExport extends SfdxCommand {

    public static description = 'Export data from an org base on dxb data plan definition file.';
  
    public static examples = [
        `$ sfdx dxb:data:export -f data/data-def.json -d data/dev -u devhub`
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        definitionfile: flags.string({char:'f',description:'path to a dxb data definition file',required:true}),
        outputdir:flags.string({char:'d',description:'path export directory',default:'.'}),
        querylimit:flags.number({char:'l',description:'Maximum number of records to fetch',default:500000}),
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;
    
    protected connection:Connection;
    protected outputdir:string;
    protected csvWriter:any;
    protected querylimit:number;
    public async run() {
        let definitionfile = this.flags.definitionfile;
        this.outputdir = this.flags.outputdir;
        this.querylimit = this.flags.outputdir;
        this.connection = this.org.getConnection();
        JSON.parse(fs.readFileSync(definitionfile).toString())
          .objects.reduce((accumulatorPromise, elem) => {
              return accumulatorPromise.then(() => {
                if (elem.active) return this.export(elem);
                return null;
              });
          }, Promise.resolve());
    }
    private export(job:any):Promise<any>{
      return new Promise((resolve, reject) => {
        job.fields = job.fields.replace(/ /g,'');
        const exportfile = path.join(this.outputdir,job.filename);
        console.log(`Register export for [\x1b[33m${job.objectName},${exportfile}\x1b[0m]`);
        let query:string = `select ${job.fields.replace(/ /g,'')} from ${job.objectName}`;
        if (job.where){
          query += ` where ${job.where}`;
        }
        job.fields = job.fields.split(',');
        job['exportfile'] = exportfile;
        job['query'] = query;
        resolve(job);
      }).then(async (result:any) => {
        return await this.startQuery(result);
      });
    }
    private startQuery(job){
      return new Promise( (resolve, reject) => {
        var records = [];
        var query:any = this.connection.query(job.query)
          .on("record", function(record) {
            records.push(record);
          })
          .on("end", function() {
            console.log('Total Records Exported :',`\x1b[32m${query.totalFetched}\x1b[0m`, 'record(s)\n');
            var headers = [];
              job.fields.forEach(function(key) {
                  const k = key.trim().toLowerCase();
                  headers.push({id: k, title: k});
              });
              var csvWriter = createCsvWriter({  
                  path: job.exportfile,
                  header: headers,
                  encoding:'utf-8'
              });
              records.forEach(element => {
                job.fields.forEach(function(key) {
                  const k = key.trim().toLowerCase();
                  if (k.indexOf('.') >= 0){ //handle cross reference fields
                    const f = key.split('.');
                    element[k] = element[f[0]] ? element[f[0]][f[1]] : null;
                    delete element[f[0]];
                  }else{  //just a normal field
                    element[k] = element[key];
                    delete element[key];
                  }
                });
                delete element.attributes;
              });
              csvWriter.writeRecords(records)       // returns a promise
              .then(() => {
                  resolve(job);
              });
          })
          .on("error", function(err) {
            console.error(err);
          })
          .run({ autoFetch : true, maxFetch : this.querylimit }); // synonym of Query#execute();
      });
    }
}
