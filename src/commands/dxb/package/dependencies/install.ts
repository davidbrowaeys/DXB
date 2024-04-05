import { execSync as exec } from 'child_process';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, PackageDir, SfProject } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'package.dependencies.install');

export type PackageDependenciesInstallResult = {
  success: boolean;
};

export default class PackageDependenciesInstall extends SfCommand<PackageDependenciesInstallResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  public static readonly requiresProject = true;

  protected projectConfig: any;
  protected orgName: string | undefined;
  protected packageDirectories: PackageDir[] = [];
  public async run(): Promise<PackageDependenciesInstallResult> {
    const { flags } = await this.parse(PackageDependenciesInstall);
    this.orgName = flags['target-org']?.getUsername();
    // project config
    this.projectConfig = await (await SfProject.resolve()).resolveProjectConfig();
    this.packageDirectories = this.projectConfig.packageDirectories;
    this.installPackages();
    return { success: true };
  }
  private installPackages(): void {
    this.log(exec(`sf package installed list --target-org ${this.orgName} --json`).toString());
    this.log(messages.getMessage('log.alias', [this.projectConfig.packageAliases]));
    this.packageDirectories.forEach((pkg) => {
      if (pkg.dependencies) {
        pkg.dependencies.forEach((elem) => {
          try {
            const packageVersion = `${elem.package}@${elem.versionNumber?.replace('.LATEST', '-1')}`;
            this.log(messages.getMessage('log.packageVersion', [packageVersion]));
            const packageID: string = this.projectConfig.packageAliases[packageVersion];
            this.log(
              `sf package install --package "${packageID}" --target-org ${this.orgName} --wait 600 --json --no-prompt`
            );
            // console.log('Installing',packageID,installedPackage.find(p => packageID === ''));
            const output = JSON.parse(
              exec(
                `sf package install --package "${packageID}" --target-org ${this.orgName} --wait 600 --json --no-prompt`
              ).toString()
            );
            if (output?.result && output.result.Status === 'SUCCESS') {
              this.log(messages.getMessage('log.installPackage', [packageID]));
            } else {
              throw messages.createError('error.errorInstall', [packageID]);
            }
          } catch (err) {
            throw messages.createError('error.cannotInstall', [JSON.stringify(err)]);
          }
        });
      }
    });
  }
}
