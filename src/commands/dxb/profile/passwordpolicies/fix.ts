import { flags, SfdxCommand } from '@salesforce/command';
import {execSync as exec} from 'child_process';
import * as fsPromises from 'fs/promises';

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
            await fsPromises.access(sourcepath, fsPromises.constants.F_OK);
            // retrieve all password policies from target org, these have a different timestamp appended to the file name than the source files
            const targetOrgPolicies: { filePath: string, fullName: string }[] = this.getAllPasswordPolicies();

            // get the file names for the source files from the source directory
            let sourceFiles:string[] = await fsPromises.readdir(sourcepath);
            for (const file of sourceFiles) {
                // find the profile password policy from the target org that starts with the same profile name as the source file
                const targetOrgPolicyToReplace:string = (
                    targetOrgPolicies.find(targetOrgPolicy => targetOrgPolicy.fullName.startsWith(file.split('profilePasswordPolicy')[0])) ||
                    { filePath: '' }
                ).filePath;
                if (targetOrgPolicyToReplace) {
                    // copy the content of the source file to the target org profile password policy. This will only copy content and not the file name from the target
                    await fsPromises.copyFile(`${sourcepath}/${file}`, targetOrgPolicyToReplace);
                }
            }
            // remove the source directory and it's content, recreate it after as an empty directory
            await fsPromises.rm(sourcepath, { force: true, recursive: true });
            await fsPromises.mkdir(sourcepath);
            sourceFiles = await fsPromises.readdir('targetOrgPolicies/profilePasswordPolicies');
            for (const file of sourceFiles) { // copy every file in the target org dir to the source dir, it will have the file name of the target org's policy but the content of the source org.
                console.log(`copy targetOrgPolicies/profilePasswordPolicies/${file} to ${sourcepath}/${file}`);
                fsPromises.copyFile(`targetOrgPolicies/profilePasswordPolicies/${file}`, `${sourcepath}/${file}`);
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