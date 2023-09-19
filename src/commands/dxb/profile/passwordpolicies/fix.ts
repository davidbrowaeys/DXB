import { flags, SfdxCommand } from '@salesforce/command';
import {execSync as exec} from 'child_process';
import * as fs from 'fs-extra';

const TARGET_MAIN_DIR = 'targetOrgPolicies';
const TARGET_POLICY_DIR = 'profilePasswordPolicies';

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

    /**
     * 
     * @param sourcepath The path where the source profile password policies are stored
     * @returns string[]
     */
    public getSourceFiles(sourcepath:string) : string[] {
        // check if sourcepath exists and continue
        fs.ensureDirSync(sourcepath);

        // get the file names for the source files from the source directory
        return fs.readdirSync(sourcepath);
    }

    /**
     * 
     * @param sourcepath The path where the source profile password policies are stored
     * @returns { filePath: string, fullName: string }[]
     */
    public getTargetFiles(): { filePath: string, fullName: string }[] {
        // retrieve all password policies from target org, these have a different timestamp appended to the file name than the source files
        fs.ensureDirSync(`${TARGET_MAIN_DIR}/main/default`);
        return this.getAllPasswordPolicies();
    }

    /**
     * Retrieves Profile Password Policies from Target Org
     * @returns { filePath: string, fullName: string }[]
     */
    public getAllPasswordPolicies(): { filePath: string, fullName: string }[] {
        console.log(`sfdx force:source:retrieve -m ProfilePasswordPolicy -u ${this.org.getUsername()} --json -r ${TARGET_MAIN_DIR}`);
        const metadata = JSON.parse(exec(`sfdx force:source:retrieve -m ProfilePasswordPolicy -u ${this.org.getUsername()} --json -r ${TARGET_MAIN_DIR}`).toString());
        return metadata.result.inboundFiles;
    }

    public async run() {
        const sourcepath = this.flags.sourcepath;
        try {
            let sourceFiles:string[] = this.getSourceFiles(sourcepath);
            if (sourceFiles.length === 0) {
                console.warn(`No source files were found in ${sourcepath}`);
                return undefined;
            }

            const targetOrgPolicies = this.getTargetFiles();
            if (targetOrgPolicies.length === 0) { // if there are no profile password policies on target, the dir targetOrgPolicies/profilePasswordPolicies needs to be created manually
                fs.ensureDirSync(`${TARGET_MAIN_DIR}/${TARGET_POLICY_DIR}`);
            }

            for (const file of sourceFiles) {
                // find the profile password policy from the target org that starts with the same profile name as the source file
                const targetOrgPolicyToReplace:string = (
                    targetOrgPolicies.find(targetOrgPolicy => targetOrgPolicy.fullName.startsWith(file.split('profilePasswordPolicy')[0])) ||
                    { filePath: `${TARGET_MAIN_DIR}/${TARGET_POLICY_DIR}/${file}` } // if profile policy does not exist in target, ensure it is copied over
                ).filePath;

                // copy the content of the source file to the target org profile password policy. This will only copy content and not the file name from the target
                fs.copyFileSync(`${sourcepath}/${file}`, targetOrgPolicyToReplace);
            }

            // remove the source directory and it's content, recreate it after as an empty directory
            fs.emptyDirSync(sourcepath);
            sourceFiles = fs.readdirSync(`${TARGET_MAIN_DIR}/${TARGET_POLICY_DIR}`);

            // copy every file in the target org dir to the source dir, it will have the file name of the target org's policy but the content of the source org.
            for (const file of sourceFiles) {
                console.log(`copy ${TARGET_MAIN_DIR}/${TARGET_POLICY_DIR}/${file} to ${sourcepath}/${file}`);
                fs.copyFileSync(`${TARGET_MAIN_DIR}/${TARGET_POLICY_DIR}/${file}`, `${sourcepath}/${file}`);
            }
        } catch (e: unknown){
            const err = e as Error;
            console.log(err.message);
        }
    }
}