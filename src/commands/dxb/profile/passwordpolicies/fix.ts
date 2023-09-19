import { flags, SfdxCommand } from '@salesforce/command';
import {execSync as exec} from 'child_process';
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
            // check if sourcepath exists and continue
            fs.accessSync(sourcepath);
            // retrieve all password policies from target org, these have a different timestamp appended to the file name than the source files
            fs.mkdirSync('targetOrgPolicies/main/default', { recursive: true });
            const targetOrgPolicies: { filePath: string, fullName: string }[] = this.getAllPasswordPolicies();

            // get the file names for the source files from the source directory
            let sourceFiles:string[] = fs.readdirSync(sourcepath);
            if (sourceFiles.length === 0) {
                console.warn(`No source files were found in ${sourcepath}`);
                return undefined;
            }
            for (const file of sourceFiles) {
                // find the profile password policy from the target org that starts with the same profile name as the source file
                const targetOrgPolicyToReplace:string = (
                    targetOrgPolicies.find(targetOrgPolicy => targetOrgPolicy.fullName.startsWith(file.split('profilePasswordPolicy')[0])) ||
                    { filePath: `targetOrgPolicies/profilePasswordPolicies/${file}` } // if profile policy does not exist in target, ensure it is copied over
                ).filePath;

                // copy the content of the source file to the target org profile password policy. This will only copy content and not the file name from the target
                fs.copyFileSync(`${sourcepath}/${file}`, targetOrgPolicyToReplace);
            }
            // remove the source directory and it's content, recreate it after as an empty directory
            fs.rmSync(`${sourcepath}`, { force: true, recursive: true });
            fs.mkdirSync(`${sourcepath}`);
            sourceFiles = fs.readdirSync('targetOrgPolicies/profilePasswordPolicies');
            for (const file of sourceFiles) { // copy every file in the target org dir to the source dir, it will have the file name of the target org's policy but the content of the source org.
                console.log(`copy targetOrgPolicies/profilePasswordPolicies/${file} to ${sourcepath}/${file}`);
                fs.copyFileSync(`targetOrgPolicies/profilePasswordPolicies/${file}`, `${sourcepath}/${file}`);
            }
        } catch (e: unknown){
            const err = e as Error;
            console.log(err.message);
        }
    }
    /**
     * Retrieve all profile password policies from an org
     */
    public getAllPasswordPolicies() {
        console.log(`sfdx force:source:retrieve -m ProfilePasswordPolicy -u ${this.org.getUsername()} --json -r targetOrgPolicies`);
        const metadata = JSON.parse(exec(`sfdx force:source:retrieve -m ProfilePasswordPolicy -u ${this.org.getUsername()} --json -r targetOrgPolicies`).toString());
        return metadata.result.inboundFiles;
    }
}