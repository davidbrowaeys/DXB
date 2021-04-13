import { flags, SfdxCommand } from '@salesforce/command';
import {execSync as exec} from 'child_process';
//import { SfdxError } from '@salesforce/core';
//import * as path from 'path';
import * as fs from 'fs';

export default class PasswordPoliciesMerge extends SfdxCommand {

    public static description = 'This command allows password policies deployment to ignore timestamp in file name';

    public static examples = [
        `$ sfdx dxb:profile:passwordpolicies:fix`
    ];

    public static args = [{ name: 'file' }];

    protected static flagsConfig = {
        profilename: flags.string({ char: 'p', description: 'Profile name to be converted' }),
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;

    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;

    protected orgname:string;

    public async run() {
        let profilename = this.flags.profilename;
        let sourcepath = this.flags.sourcepath;
        this.orgname = this.org.getUsername();
        if (profilename) {
            try {
                //do something
            } catch (err) {
                console.log(`Could not convert ${profilename}`);
            }
        } else {
            fs.readdirSync(sourcepath).forEach(file => {
                //sfdx force:source:retrieve -mProfilePasswordPolicy -u wavmsst --json
            });
        }
    }
    /**
     * name
     */
    public getAllPasswordPolicies() {
        var metadata = JSON.parse(exec(`sfdx force:source:retrieve -m ProfilePasswordPolicy -u ${this.orgname} --json`).toString());
        console.log(metadata.result.inboundFiles);
    }
}