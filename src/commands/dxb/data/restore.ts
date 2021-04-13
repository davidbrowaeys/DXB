
import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError,Connection } from '@salesforce/core';
import * as fs from 'fs';
import * as path from 'path';
import * as csvp from 'csv-parser';
import {createObjectCsvWriter as createCsvWriter} from 'csv-writer';


export default class DataRestore extends SfdxCommand {

    public static description = 'Extract certificates from partner community. You must have access to parner commuunity in order to use this command.';
  
    public static examples = [
        `$ sfdx dxb:data:backup -f backup-def.json -d backup -m full -u devhub`,
        `$ sfdx dxb:data:backup -f backup-def.json -d backup -m delta -u devhub`
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        backupdir: flags.string({char:'f',description:'path to a data backup cycle root folder, i.e.: backup/cycle-1',required:true})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;
    
    protected connection:Connection;
    protected setting:any;
    protected backupdir:string;

    public async run() {
        this.connection = this.org.getConnection();
        this.backupdir = this.flags.backupdir;
        this.config = JSON.parse(fs.readFileSync(path.join(this.backupdir,'full/log.json')).toString());

        this.restoreFull();
        //await this.restoreDeltas();
        //await this.cleanupNewRecords();
    }

    private async restoreFull(){
        var files = fs.readdirSync( path.join(this.backupdir,'full') );
        await files.forEach( async (f:string) => {
            if (f.endsWith('.csv')){
                await this.processFile(path.join(this.backupdir,'full'),f);
            }
        });
    }

    private processFile(filepath, file):Promise<any>{
        return new Promise( async (resolve, reject) => {
            console.log('Step 1');
            const object = file.split('.')[0];
            const outputfile = path.join(this.backupdir,`${object}_out.csv`);
            let fields = await this.getSupportedObjectFields(object);
            this.ux.logJson({fields,object,file,filepath,outputfile});
            resolve({fields,object,file,filepath,outputfile});
        }).then((results:any) => {
            console.log('Step 2');
            this.prepareImportFile(results.object, path.join(results.filepath,results.file), results.outputfile, results.fields);
            return results;
        }).then((results:any) => {
            console.log('Step 3');
            var records = this.upsertRecords(results.object, results.outputfile );
            return records;
        });
    }

    // private async restoreDeltas(){
    //     for (let i:number = 1 ; i <= this.setting.delta.cycle; i++){
    //         var files = fs.readdirSync( path.join(this.backupdir,'delta',i.toString()) );
    //         files.forEach( async (file:string) => {
    //             if (file.endsWith('.csv')){
    //                 const object = file.split('.')[0];
    //                 const res = await this.upsertRecords(object, path.join(this.backupdir,'delta',i.toString(), file) );
    //                 console.log(res);
    //             }
    //         });
    //     }
    // }

    private upsertRecords(object, filename, externalIdField = 'Id'){
        this.ux.log(object, filename);
        var csvFileIn:any = fs.createReadStream(filename);
        this.connection.bulk.load(object, "upsert", {extIdField:externalIdField}, csvFileIn, (err:any, rets:any) => {
            if (err) { throw new SfdxError(err.message); }
            for (var i=0; i < rets.length; i++) {
                if (rets[i].success) {
                    console.log("#" + (i+1) + " loaded successfully, id = " + rets[i].id);
                } else {
                    console.log("#" + (i+1) + " error occurred, message = " + rets[i].errors.join(', '));
                }
            }
            return rets;
        });
    }
    

    // private async deleteRecords(object, fromDate):Promise<any>{
    //     return new Promise((resolve, reject) => {
    //         this.connection.query(`SELECT Id FROM ${object} WHERE CreatedDate >= ${fromDate}`)
    //         .destroy(function(err, rets) {
    //           if (err) { return reject(err); }
    //           resolve(rets);
    //         });
    //     });
    // }

    /**
     * @description Retrieve Object fields 
     */
    private getSupportedObjectFields(objectname){
        this.connection.sobject(objectname).describe(function(err, meta) {
            if (err) { throw new SfdxError(err.message); }
            let t:string[] = [];
            meta.fields.forEach( (f) => {
                if (f.createable || f.updateable || f.name === 'Id'){
                t.push(f.name);
                }else{

                }
            });
            return t;
        });
    }

    private prepareImportFile(objectname, filename, outputfile, fields){
            //define headers
            var rowHeaders = [{}];
            var headers = [];
            fields.forEach(function(key) {
                rowHeaders[0][key] = key;
                headers.push({id: key, title: key});
            });
            //init out file
            fs.writeFileSync(outputfile,"");
            const csvWriter = createCsvWriter({  
                path: outputfile,
                header: headers,
                append: true,
                encoding:'utf8'
              });
            csvWriter.writeRecords(rowHeaders);
            //start data masking
            this.ux.startSpinner('Preparing file import...');
            fs.createReadStream(filename)  //read data source
            .pipe(csvp())
            .on('data', (row) => {
                var record = {};
                for (let s of fields){
                    record[s] = row[s];
                }
                csvWriter.writeRecords([record]);
            })
            .on('end', () => {
                //fs.unlinkSync(filename);
                //fs.renameSync(`${objectname}_out.csv`,,filename);
                this.ux.stopSpinner("Done");
        });
    }
}

/******* SCENARIOS
                                |SP|
Full            D1          D2         D3
---------------------------------------------------------->
X               X           X           X                       N/A
X               X           X           V                       UPSERT
X               X           V           V                       UPSERT   
X               V           V           V                       UPSERT
V               V           V           V                       UPSERT

X               V           V           X                       DELETE?

V               V           V           X                       DELETE?
V               V           X           X                       DELETE? 
V               X           X           X                       DELETE? 
V               X           V           V                       UPSERT    
 */



