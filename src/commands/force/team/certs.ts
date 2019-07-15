
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';

const fs = require('fs');
const exec = require('child_process').execSync;
const csvp = require('csv-parser'); 


export default class TeamCerts extends SfdxCommand {

    public static description = 'Extract certificates from partner community. You must have access to parner commuunity in order to use this command.';
  
    public static examples = [
        `$ deloitte force:team:certs`
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {};
    // Comment this out if your command does not require an org username
    protected static requiresUsername = false;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;
    
    public async run() {
        if (!process.env.CERTIFICATEFILEPATH || !process.env.CERTFICATEDB){
            throw new SfdxError('\nYou must add 2 env. variables in your .bash_profile in order to use this commands ,examples : \n' + 
            '> export CERTIFICATEFILEPATH=~/Downloads/CertificationsCSV.csv\n' + 
            '> export CERTFICATEDB=~/Documents/aunz_certs.json' 
            );
        }
        this.ux.log('Login to partner community and download certifications. Apply filter by Region to get only ANZ then click on Export to CSV.');
        this.ux.log(exec(`open https://partners.salesforce.com/CertificationsPage`).toString());
        var stdin = require('readline-sync');
        while(true) {
            var yn = stdin.question("Would you like to continue?(Y/N)");
            if(yn.toLowerCase() === 'y' ) {
                break;
            } else {
                process.exit();
            }
        }

        var oldCerts = JSON.parse(fs.readFileSync(process.env.CERTFICATEDB).toString());
        var newCerts = {};
        var hasNewCerts = false;
        if (!fs.existsSync(process.env.CERTIFICATEFILEPATH)){
            throw new SfdxError('File not found...\n' + process.env.CERTIFICATEFILEPATH);
        }
        fs.createReadStream(process.env.CERTIFICATEFILEPATH)  
        .pipe(csvp())
        .on('data', (row) => 
        {
            if (row["Country"] === "AU" || row["Country"] === "NZ"){
                if(!oldCerts[row.Name]) oldCerts[row.Name] = [];
                if(!oldCerts[row.Name].includes(row["Certifications Achieved"])){
                    oldCerts[row.Name].push(row["Certifications Achieved"]);
                    if (!hasNewCerts){
                        hasNewCerts = true;
                        console.log(
                            'Team, please join me to congratulate the following people for passing their certification(s) !\n',
                        );
                    }
                    if(!newCerts[row.Name]){
                        console.log('\x1b[91m%s\x1b[0m', row.Name,"(",row.Country,"): ");
                        newCerts[row.Name] = [];
                    }
                    console.log(' > ', row["Certifications Achieved"]);
                    newCerts[row.Name].push(row["Certifications Achieved"]);
                }
            }
        })
        .on('end', () => {
            if (!hasNewCerts) 
                this.ux.log(
                    '\n==============================================\n',
                    'Bugger, there are no new certifications today!\n',
                    '==============================================\n'
                );
            fs.writeFileSync(process.env.CERTFICATEDB, JSON.stringify(oldCerts, null, 2));
            if (fs.existsSync(process.env.CERTIFICATEFILEPATH))fs.unlinkSync(process.env.CERTIFICATEFILEPATH);
        });
        return {"anz":oldCerts};
    }
}
