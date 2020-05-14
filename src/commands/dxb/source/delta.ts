import { flags, SfdxCommand } from '@salesforce/command';
import {execSync as exec} from 'child_process';

let basedir: string;
export default class extends SfdxCommand {

  public static description = 'This command generate delta package by doing git diff.';

  public static examples = [
    `$ sfdx dxb:source:delta -m tags -k mytag`,
    `$ sfdx dxb:source:delta -m branch -k origin/master`,
    `$ sfdx dxb:source:delta -m commitid -k 123456`,
  ];

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    mode: flags.string({ char: 'm', description: 'commitid|tags|branch', default: "commitid" }),
    deltakey: flags.string({ char: 'k', description: 'commit id, tags prefix or name, branch name' }),
    basedir: flags.string({ char: 'd', description: 'path of base directory', default: 'force-app/main/default' }),
    testclsnameregex: flags.string({ char: 'n', description: 'Regex for test classes naming convention', default: '.*Test' })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  protected testClasses: string[] = [];
  protected allClasses: string[] = [];
  protected processedClasses: string[] = [];
  protected regex;
  public async run() {
    let mode = this.flags.mode;
    let deltakey = this.flags.deltakey;
    this.regex = this.flags.testclsnameregex;
    basedir = this.flags.basedir;

    let deltaMeta = this.getDeltaChanges(mode, deltakey);
    let deployOutput = '';
    if (deltaMeta && deltaMeta.length > 0) {
      deployOutput += `${deltaMeta.join(',')}`;
    } 
    this.ux.log(deployOutput);
    return { deltaMeta }
  }
  private onlyUnique(value: any, index: any, self: any) {
    return self.indexOf(value) === index && value.startsWith(basedir);
  }
  public getDeltaChanges(mode: any, deltakey: any): any {
    var gitresult;
    if (mode === 'branch') {
      gitresult = exec(`git diff ${deltakey} --name-only`).toString().split('\n');
    } else if (mode === 'tags') {
      if (deltakey) {
        gitresult = exec(`git diff $(git describe --match ${deltakey}* --abbrev=0 --all)..HEAD --name-only`).toString().split('\n');
      } else {
        gitresult = exec(`git diff $(git describe --tags --abbrev=0 --all)..HEAD --name-only`).toString().split('\n');
      }
    } else {
      gitresult = exec(`git diff-tree --no-commit-id --name-only -r ${deltakey}`).toString().split('\n'); //this only work with specific commit ids, how to get file that changed since last tag ? 
    }
    //filter unnecessary files
    var files = gitresult.filter(this.onlyUnique);
    return files;
  }
}