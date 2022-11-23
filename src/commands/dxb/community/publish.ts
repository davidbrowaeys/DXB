import { flags, SfdxCommand } from '@salesforce/command';
const exec = require('child_process').execSync;

export default class CommunityPublish extends SfdxCommand {

    public static description = 'Convert profile xml into small chunks of json files';

    public static examples = [
        `$ sfdx dxb:source:package:retrieve -f package.xml`
    ];

    public static args = [{ name: 'file' }];

    protected static flagsConfig = {
        name: flags.string({char:'n',description:'Comma separated community name. If not specified, then will fetch all "Live" communities from target env'})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;

    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;

    public async run() {
        let name = this.flags.name;
        const username = this.org.getUsername();
        if (name){
            name.split(',').forEach( (elem) => {
                console.log(exec(`sfdx force:community:publish -n ${elem} -u ${username}`).toString());
            })
        }else{
            const allcommunities = JSON.parse(exec(`sfdx force:data:soql:query -q "SELECT Name FROM Network WHERE Status = 'Live'" --resultformat json -u ${username}`).toString());
            if (allcommunities !== null){
                allcommunities.result?.records?.forEach( (elem) => {
                    console.log(exec(`sfdx force:community:publish -n ${elem.Name} -u ${username}`).toString());
                })
            }
        }
        
    }
}