import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError } from '@salesforce/core';
//import { Messages, SfdxError } from '@salesforce/core';

const fs = require("fs-extra");
const path = require('path');
const exec = require('child_process').execSync;
let basedir:string;
export default class  extends SfdxCommand {

  public static description = 'This command generate delta package by doing git diff.';

  public static examples = [
  `$ sfdx dxb:source:delta -r -m tags -k mytag`,
  `$ sfdx dxb:source:delta -r -m commitid -k 123456`,
  `$ sfdx dxb:source:delta -r -m branch -k origin/master`
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    mode: flags.string({char: 'm',description: 'commitid|tags|branch', default:"commitid"}),
    deltakey: flags.string({char: 'k', description: 'commit id, tags prefix or name, branch name'}),
    metatype:flags.string({char: 't',description: 'metatype comma separated, i.e.: objects,classes,workflows', default: 'objects,classes,workflows'}),
    basedir: flags.string({char: 'd', description: 'path of base directory', default:'force-app/main/default'}),
    testlevel: flags.string({char: 'l', description: 'if set to "RunSpecifiedTests", command will try to calculate test classes dependencies.', default:'NoTestRun'})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  protected testClasses = [];
  protected allClasses = [];
  protected processedClasses = [];

  public async run() {
    let mode = this.flags.mode;
    let deltakey = this.flags.deltakey;
    let testlevel = this.flags.testlevel;
    let metatypes = this.flags.metatype.split(',');
    basedir = this.flags.basedir;

    let deltaMeta = this.getDeltaChanges(mode,deltakey);
    //find dependent test classes
    if (testlevel === 'RunSpecifiedTests'){ 
      //retrieve all classes
      fs.readdirSync( path.join(basedir, 'classes') ).forEach( (file:string) => {
        if (file.endsWith('.cls')) this.allClasses.push(file);
      }); 
      //go through delta changes
      deltaMeta.forEach( (file:any) => {
          file = path.parse(file);
          this.processedClasses = [];
          metatypes.forEach( (type:string) => {
          if (file.dir.startsWith(path.join(basedir,type))){
              if ( ( type === 'classes' && file.base.endsWith('cls') ) || type === 'workflows' || (type === 'objects' && file.base.endsWith('object-meta.xml'))){
              this.getTestClasses(path.join(basedir,'classes'), type, file.name);
              }else if (type === 'objects' && (file.base.endsWith('field-meta.xml') || file.base.endsWith('validationRule-meta.xml'))){
              var parentfolder = path.normalize(path.join(file.dir,'..'));
              this.getTestClasses(path.join(basedir,'classes'), type, path.parse(parentfolder).name);
              }
          }
          });
      });
    }
    let deployOutput = '';
    if (deltaMeta && deltaMeta.length > 0){
      deployOutput += `-p ${deltaMeta.join(',')}`;
    }else{
      deployOutput += `-p ${basedir}`;
    }
    if (testlevel === 'RunSpecifiedTests'){ 
      if (this.testClasses && this.testClasses.length > 0){
        deployOutput += `-r "${this.testClasses.join(',')}"`; 
      }else{
        throw new SfdxError('No test classes found.');
      }
    }
    this.ux.log(deployOutput);
    return {deltaMeta, testClasses: this.testClasses}
  }
  private onlyUnique(value:any, index:any, self:any) { 
    return self.indexOf(value) === index && value.startsWith(basedir);
  }
  private getTestClasses(classpath:string, type:string, element:string){
    //check if the element is a test classes
    if (type === 'classes' && !this.testClasses.includes(element) && element.indexOf('Test') >= 0){
        this.testClasses.push(element);
        return;
    }
    //go through each classes and check if element is referenced in the file content (case senstive ?!)
    this.allClasses.forEach( f => {
      let file:any = path.parse( f );
      if (!this.testClasses.includes(file.name)){
        var content = fs.readFileSync(f).toString();
          if (content.indexOf(element) >= 0 && !this.processedClasses.includes(file.name)){ //make sure we don't re-process a class already processed
              this.processedClasses.push(file.name);
              this.getTestClasses(classpath, 'classes', file.name);
          }
        }
    });
  }
  public getDeltaChanges(mode:any,deltakey:any):any{
    var gitresult;
    if (mode === 'branch'){
    gitresult = exec(`git diff ${deltakey} --name-only`).toString().split('\n');
    }else if (mode === 'tags'){
    if (deltakey) {
        gitresult = exec(`git diff $(git describe --match ${deltakey}* --abbrev=0 --all)..HEAD --name-only`).toString().split('\n');
    }else{
        gitresult = exec(`git diff $(git describe --tags --abbrev=0 --all)..HEAD --name-only`).toString().split('\n');
    }
    }else{
    gitresult = exec(`git diff-tree --no-commit-id --name-only -r ${deltakey}`).toString().split('\n'); //this only work with specific commit ids, how to get file that changed since last tag ? 
    }
    //filter unnecessary files
    var files = gitresult.filter( this.onlyUnique );
    return files;
  }

  public getAllClasses(directory){
    var currentDirectorypath = path.join(directory);

    var currentDirectory = fs.readdirSync(currentDirectorypath, 'utf8');

    currentDirectory.forEach(file => {
        var pathOfCurrentItem = path.join(directory + '/' + file);
        if (fs.statSync(pathOfCurrentItem).isFile() && file.endsWith('.cls')) {
          this.allClasses.push(pathOfCurrentItem);
        }
        else {
            var directorypath = path.join(directory + '/' + file);
            this.getAllClasses(directorypath);
        }
    });
  }
}