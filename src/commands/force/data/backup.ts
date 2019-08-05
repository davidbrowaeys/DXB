
import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError } from '@salesforce/core';
import * as fs from 'fs';
import * as path from 'path';
import {execSync as exec} from 'child_process';


export default class DataBackup extends SfdxCommand {

    public static description = 'Extract certificates from partner community. You must have access to parner commuunity in order to use this command.';
  
    public static examples = [
        `deloitte force:data:backup -m full -d backup -f config/backup-def.json -u devhub`,
        `deloitte force:data:backup -m delta -d backup -f config/backup-def.json -u devhub`
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        definitionfile: flags.string({char:'f',description:'path to a data backup definition file',required:true}),
        mode: flags.string({char:'m',description:'data backup mode (delta|full)',default:'full'}),
        outputdir:flags.string({char:'d',description:'path to main data backup directory',default:'.'})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;
    
    public async run() {
        let definitionfile = this.flags.definitionfile;
        let outputdir = this.flags.outputdir;
        let mode = this.flags.mode;
        let orgname = this.org.getUsername();
        var allconfig = JSON.parse(fs.readFileSync(definitionfile).toString());
        if (mode !== 'full' && mode !== 'delta'){
            throw new SfdxError(`Invalid backup mode spefified. You can only select delta or full backup.`);
        }
        if (!allconfig[orgname] || !allconfig[orgname][mode]){
            throw new SfdxError(`No backup configuration found in ${definitionfile} for this user`);
        }
        let config = allconfig[orgname];
        const startTime = new Date();
        if (mode === 'full'){   //run full mode using bulk api
            config.full.cycle++;
            outputdir = path.join(outputdir,'cycle-' +config.full.cycle,'full');  
            fs.mkdirSync(outputdir, { recursive: true });
            config.full.objects.forEach(object => {
                this.ux.log(`\nBackup ${object} :`);
                exec(`deloitte force:data:bulk:query -o ${object} -u ${orgname} --allfields -d ${outputdir}`);
                //console.log(exec(`wc -l ${outputdir}/${object}`).toString());
            });
            config.full.backupTime = startTime;
            //init first delta
            config.delta.cycle = 0;
            config.delta.backupTime = startTime;
            fs.writeFileSync(path.join(outputdir,'log.json'), JSON.stringify(config, null, 2));
        }else if (mode === 'delta'){
            //since what savepoint do we want to get delta ? 
            var lastDeltaTime = null;
            if (!config.delta.backupTime || config.delta.delta_type == 'since_full'){
                lastDeltaTime = config.full.backupTime;
            }else {
                lastDeltaTime = config.delta.backupTime;
            }
            config.delta.backupTime = startTime;
            config.delta.cycle++;
            //create output dir for delta if doesn't exist. 
            outputdir = path.join(outputdir,'cycle-' +config.full.cycle,'delta', config.delta.delta_type === 'since_full' ? 1 : config.delta.cycle.toString());
            if (!fs.existsSync(outputdir)){
                fs.mkdirSync(outputdir, { recursive: true });
            }
            //for each object run query
            config.delta.objects.forEach( async (object) => {
                this.ux.log(object);
                //retrieve new and updated records since last delta
                let filename = path.join(outputdir,object + '.csv');
                let query = await this.generateQuery(this.org.getConnection(), object, true);
                let soql1 = `${query} WHERE LastModifiedDate >= ${lastDeltaTime}`;
                this.ux.log('Retrieve delta for '+object);
                this.ux.startSpinner('Processing...');
                var result = await this.queryAll(this.org.getConnection(), soql1, filename);
                this.ux.stopSpinner('Done');
                //retrieve deleted records
                // let soql2 = `${query} WHERE THIS_YEAR`;
                // this.ux.log('Retrieve deleted records for '+object);
                // this.ux.startSpinner('Processing...');
                // var result = await this.queryAll(this.org.getConnection(), soql2, filename);
                // this.ux.stopSpinner('Done');
            });
            fs.writeFileSync(path.join(outputdir,'log.json'), JSON.stringify(config, null, 2));
        }
        //update definition file
        allconfig[orgname] = config;
        fs.writeFileSync(definitionfile, JSON.stringify(allconfig, null, 2));
    }

    private async generateQuery(connection, objectname, allfields){
        let soql = ['SELECT'];
        let fields = [];
        if (allfields){
            fields = await this.getObjectFields(connection,objectname);
        }else{
          fields.push('Id');
        }
        soql.push(fields.join(","));
        soql.push('FROM');
        soql.push(objectname);
        return soql.join(" ");
    }

    private async queryAll(connection, soql, outputFile):Promise<string>{
        return new Promise((resolve, reject) => {
          var csvFileOut = fs.createWriteStream(outputFile);
          connection.query(soql)
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
    private async getObjectFields(connection, objectname):Promise<string[]>{
        return new Promise((resolve, reject) => {
          connection.sobject(objectname).describe(function(err, meta) {
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
