
import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError,Connection } from '@salesforce/core';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import * as csvSplitStream from 'csv-split-stream';
import {createObjectCsvWriter as createCsvWriter} from 'csv-writer';


export default class DataTransferImport extends SfdxCommand {

    public static description = 'Import data to an org base on dxb data plan definition file.';
  
    public static examples = [
        `$ sfdx dxb:data:transfer:import -f data/data-def.json -d data/sit -u devhub`
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        definitionfile: flags.string({char:'f',description:'path to a dxb data definition file',required:true}),
        datadir: flags.string({char:'d',description:'path of data to import',required:true}),
        pollingtimeout: flags.milliseconds({char:'i',description:'Bulk polling timeout in milliseconds'})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;
    
    protected connection:Connection;
    protected setting:any;
    protected datadir:string;
    protected importdir:string;
    protected definitionfile:string;
    protected objectdescribes:any;
    public async run() {
        
        this.definitionfile = this.flags.definitionfile;
        this.datadir = this.flags.datadir;
        this.setting = JSON.parse(fs.readFileSync(this.definitionfile).toString());
        this.objectdescribes = {};

        this.connection = this.org.getConnection();
        this.connection.bulk.pollTimeout = this.flags.pollingtimeout || this.setting.pollTimeout || 10000000; // 10 min
        if (!fs.existsSync(this.datadir)) {
            throw new SfdxError('This folder do not exist.');
        }
        if (!fs.existsSync(path.join(this.datadir,'.tmp'))) {
            fs.mkdirSync(path.join(this.datadir,'.tmp'));    
        }
        this.importdir = path.join(this.datadir,'.tmp','log_' + new Date().getTime());
        fs.mkdirSync(this.importdir);
        this.setting.objects.reduce( (accumulatorPromise, elem) => {
            return accumulatorPromise.then(() => {
                if (elem.active) return this.import(elem);
                return null;
            });
        }, Promise.resolve());
    }

    private import(config:any):Promise<any>{
        return new Promise( async (resolve, reject) => {
            const filepath = path.join(this.datadir,config.filename);
            const importfile = path.join(this.importdir,`tmp_${config.filename}`);
            console.log(`Register import for [\x1b[33m${config.objectName},${filepath}\x1b[0m]`);
            if (this.objectdescribes[config.objectName] === undefined) {
                this.objectdescribes[config.objectName] = await this.getObjectDescribe(config.objectName);
            }
            if (config.fields === '*') {
                config.fields = this.objectdescribes[config.objectName].fields;
            }else{
                config.fields = config.fields.split(',');
            }
            config['importfile'] = importfile;
            config['filepath'] = filepath;
            resolve({config});
        }).then(async (results:any) => {
            console.log('Preparing file....');
            return await this.initFile(results.config);
         }).then(async (results:any) => {
            console.log('Import data to org...');
            return await this.splitByChunks(results.objectName, results.importfile, results.externalField );
        });
    }

    /**
     * @description Retrieve Object fields 
     */
    private getObjectDescribe(objectname){
        return new Promise( (resolve, reject) => {
            this.connection.sobject(objectname).describe(function(err, meta) {
                if (err) { throw new SfdxError(err.message); }
                let fields:string[] = [];
                meta.fields.forEach( (f) => {
                    if (f.createable || f.updateable || f.name === 'Id'){
                        fields.push(f.name);
                    }
                });
                let recordTypes:any = {};
                meta.recordTypeInfos.forEach( (rt) => {
                    recordTypes[rt.developerName] = rt.recordTypeId;
                });
                resolve({fields,recordTypes});
            });
        });
    }
    /**
     * 
     * @param objectname 
     * @param filename 
     * @param outputfile 
     * @param fields 
     */
    private initFile(config){
        return new Promise( (resolve, reject) => {
            //define headers
            var headers = [];
            var rowHeaders = [];

            config.fields.forEach(function(key) {
                key = key.trim().toLowerCase();
                rowHeaders.push(key);
                if (key === 'recordtype.developername'){    //replace RecordType.DeveloperName column by recordtypeid
                    headers.push({id: 'recordtypeid', title: 'recordtypeid'});
                }else{
                    headers.push({id: key, title: key});
                }
            });
            //init out file
            fs.writeFileSync(config.importfile,"");
            const csvWriter = createCsvWriter({  
                path: config.importfile,
                header: headers,
                append: true,
                encoding:'utf8'
            });
            //start data masking
            var isHeader = true;
            fs.createReadStream(config.filepath)  //read data source
            .pipe(csv(rowHeaders))
            .on('data', (row) => {
                var rec = {};
                rowHeaders.forEach( (f) => {
                    if (f === 'recordtype.developername'){
                        const rt = row[f];      //get developer name of the RT
                        if (!isHeader)
                            rec['recordtypeid'] = this.objectdescribes[config.objectName].recordTypes[rt]; //set with RT id  with target env
                        else    //because first line is the header. 
                            rec['recordtypeid'] = 'recordtypeid';
                    }else{
                        rec[f] = row[f];
                    }
                });
                csvWriter.writeRecords([rec]);
                if (isHeader)isHeader = false;
            })
            .on('end', () => {
                resolve(config);
            });
        });
    }

    private splitByChunks(object, filename, externalIdField = 'Id'){
        return new Promise( (resolve, reject) => {
            csvSplitStream.split(
                fs.createReadStream(filename),
                {
                  lineLimit: 10000
                },
                (index) => fs.createWriteStream(filename.split('.csv').join(index+'.csv'))
              )
              .then( async (csvSplitResponse) => {
                fs.unlinkSync(filename);
                for (var i = 0; i < csvSplitResponse.totalChunks; i++){
                    console.log(`Batch ${i+1} out of ${csvSplitResponse.totalChunks}...`);
                    var fn = filename.split('.csv').join(i+'.csv');
                    await this.upsertRecords(object, fn , externalIdField);
                }
                resolve('Split resolve'); 
              }).catch(csvSplitError => {
                console.log('csvSplitStream failed!', csvSplitError);
              });
        });
    }

    private upsertRecords(object, filename, externalIdField = 'Id'){
        return new Promise( (resolve, reject) => {
            var csvFileIn:any = fs.createReadStream(filename);
            this.connection.bulk.load(object, "upsert", {extIdField:externalIdField}, csvFileIn, (err:any, rets:any) => {
                if (err) { 
                    console.error(err.message); 
                }else if (rets){
                    var results = {
                        success : [],
                        errors : []
                    }
                    for (var i=0; i < rets.length; i++) {
                        if (rets[i].success) {
                            results.success.push(rets[i]);
                        } else {
                            results.errors.push(rets[i]);
                            if (results.errors.length <= 5 ) {
                                console.log('    ', rets[i].errors.join(', '));
                            }
                        }
                    }
                }
                console.log('Imported :',`\x1b[32m${results.success.length}\x1b[0m`,'succeed -',`\x1b[31m${results.errors.length}\x1b[0m`, 'failed\n');
                fs.unlinkSync(filename);
                resolve(results);
            });
        });
    }
}