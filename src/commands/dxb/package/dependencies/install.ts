
import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxProject, SfdxError } from '@salesforce/core';
import { execSync as exec } from 'child_process';

interface PackageDirectory {
  path: string;
  default: boolean;
  dependencies: any[];
}

export default class extends SfdxCommand {

  public static description = 'This command generate delta package by doing git diff.';

  public static examples = [
    `$ sfdx dxb:package:dependencies:install`,
  ];

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    mode: flags.string({ char: 'm', description: 'commitid|tags|branch', default: "commitid" })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  protected projectConfig;
  protected orgName;
  protected packageDirectories: PackageDirectory[] = [];
  public async run() {
    this.orgName = this.org?.getUsername();
    //project config
    this.projectConfig = await  (await SfdxProject.resolve()).resolveProjectConfig();
    this.packageDirectories = this.projectConfig.packageDirectories;
    await this.installPackages();
  }
  private async installPackages(){
    var installedPackage =  JSON.parse(exec(`sfdx package:installed:list --json`).toString());
    console.log(JSON.stringify(installedPackage));
    console.log('alias',this.projectConfig.packageAliases);
    this.packageDirectories.forEach(pkg =>{
        if ( pkg.dependencies){
            pkg.dependencies.forEach( (elem) => {
                try{
                    const packageVersion = `${elem.package}@${elem.versionNumber.replace('.LATEST','-1')}`;
                    console.log('packageVersion',packageVersion);
                    const packageID = this.projectConfig.packageAliases[packageVersion];
                    console.log(`sfdx force:package:install --package "${packageID}" -u ${this.orgName} -w 600 --json -r`);
                    // console.log('Installing',packageID,installedPackage.find(p => packageID === ''));
                    var output = JSON.parse(exec(`sfdx force:package:install --package "${packageID}" -u ${this.orgName} -w 600 --json -r`).toString());
                    if (output && output.result && output.result.Status === 'SUCCESS'){
                        console.log(`Successfully installed package [${packageID}]`);
                    }else{
                        throw new SfdxError(`Error while installing package [${packageID}]`);
                    }
                }catch(err){
                    throw new SfdxError('Unable to install packages dependencies!',JSON.stringify(err));
                }
            });
        }
      });
  }
}
