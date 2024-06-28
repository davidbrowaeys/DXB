import { execSync as exec } from 'child_process';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import * as fs from 'fs-extra';
import { Messages } from '@salesforce/core';

const TARGET_MAIN_DIR = 'targetOrgPolicies';
const TARGET_POLICY_DIR = 'profilePasswordPolicies';
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'profile.passwordpolicies.fix');

export type ProfilePasswordpoliciesFixResult = {
  success: boolean;
};

export default class ProfilePasswordpoliciesFix extends SfCommand<ProfilePasswordpoliciesFixResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = ['$ sfdx dxb:profile:passwordpolicies:fix'];

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'source-path': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.source-path.summary'),
      default: 'force-app/main/default/profilePasswordPolicies',
      exists: true,
      aliases: ['sourcepath'],
      deprecateAliases: true,
    }),
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  public static readonly requiresProject = true;

  private orgName: string | undefined;

  public async run(): Promise<ProfilePasswordpoliciesFixResult> {
    const { flags } = await this.parse(ProfilePasswordpoliciesFix);
    const sourcepath = flags['source-path'];
    this.orgName = flags['target-org']?.getUsername();
    try {
      let sourceFiles: string[] = this.getSourceFiles(sourcepath);
      if (sourceFiles.length === 0) {
        this.warn(messages.createWarning('warning.noFiles', [sourcepath]));
        return { success: false };
      }

      const targetOrgPolicies = this.getTargetFiles();
      if (targetOrgPolicies.length === 0) {
        // if there are no profile password policies on target, the dir targetOrgPolicies/profilePasswordPolicies needs to be created manually
        fs.ensureDirSync(`${TARGET_MAIN_DIR}/${TARGET_POLICY_DIR}`);
      }

      for (const file of sourceFiles) {
        // find the profile password policy from the target org that starts with the same profile name as the source file
        const targetOrgPolicyToReplace: string = (
          targetOrgPolicies.find((targetOrgPolicy) =>
            targetOrgPolicy.fullName.startsWith(file.split('profilePasswordPolicy')[0])
          ) ?? { filePath: `${TARGET_MAIN_DIR}/${TARGET_POLICY_DIR}/${file}` }
        ).filePath; // if profile policy does not exist in target, ensure it is copied over

        // copy the content of the source file to the target org profile password policy. This will only copy content and not the file name from the target
        fs.copyFileSync(`${sourcepath}/${file}`, targetOrgPolicyToReplace);
      }

      // remove the source directory and it's content, recreate it after as an empty directory
      fs.emptyDirSync(sourcepath);
      sourceFiles = fs.readdirSync(`${TARGET_MAIN_DIR}/${TARGET_POLICY_DIR}`);

      // copy every file in the target org dir to the source dir, it will have the file name of the target org's policy but the content of the source org.
      for (const file of sourceFiles) {
        this.log(`copy ${TARGET_MAIN_DIR}/${TARGET_POLICY_DIR}/${file} to ${sourcepath}/${file}`);
        fs.copyFileSync(`${TARGET_MAIN_DIR}/${TARGET_POLICY_DIR}/${file}`, `${sourcepath}/${file}`);
      }
      return { success: true };
    } catch (e: unknown) {
      const err = e as Error;
      this.error(err.message);
    }
  }

  /**
   *
   * @param sourcepath The path where the source profile password policies are stored
   * @returns string[]
   */
  // eslint-disable-next-line class-methods-use-this
  public getSourceFiles(sourcepath: string): string[] {
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
  public getTargetFiles(): Array<{ filePath: string; fullName: string }> {
    // retrieve all password policies from target org, these have a different timestamp appended to the file name than the source files
    fs.ensureDirSync(`${TARGET_MAIN_DIR}/main/default`);
    return this.getAllPasswordPolicies();
  }

  /**
   * Retrieves Profile Password Policies from Target Org
   *
   * @returns { filePath: string, fullName: string }[]
   */
  public getAllPasswordPolicies(): Array<{ filePath: string; fullName: string }> {
    this.log(
      `sf project retrieve start --metadata ProfilePasswordPolicy --target-org ${this.orgName} --json --output-dir ${TARGET_MAIN_DIR}`
    );
    const metadata: { result: { inboundFiles: Array<{ filePath: string; fullName: string }> } } = JSON.parse(
      exec(
        `sf project retrieve start --metadata ProfilePasswordPolicy --target-org ${this.orgName} --json --output-dir ${TARGET_MAIN_DIR}`
      ).toString()
    );
    return metadata.result.inboundFiles;
  }
}
