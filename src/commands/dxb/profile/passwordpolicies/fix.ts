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
        sourcepath: flags.string({ char: 'r', description: 'Path to profile files', default: 'force-app/main/default/profilePasswordPolicies' })
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;

    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;

    protected orgname:string;

    public async run() {
        const sourcepath = this.flags.sourcepath;
        try {
        } catch (e: unknown){
            const err = e as Error;
            console.log(err.message);
        }
    }
    /**
     * name
     */
    public getAllPasswordPolicies() {
        const metadata = JSON.parse(exec(`sfdx force:source:retrieve -m ProfilePasswordPolicy -u ${this.org.getUsername()} --json -r targetOrgPolicies`).toString());
        return metadata.result.inboundFiles;
    }
}