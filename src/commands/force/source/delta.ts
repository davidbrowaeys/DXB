import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';

const fs = require("fs-extra");
const path = require('path');
const exec = require('child_process').execSync;

function onlyUnique(value, index, self) { 
  return self.indexOf(value) === index && value.startsWith('force-app');
}

export default class  extends SfdxCommand {

  public static description = '';

  public static examples = [
  `$ deloitte force:source:delta -r delta -m tags -p mytag`,
  `$ deloitte force:source:delta -r delta -m commitid -k 123456`,
  `$ deloitte force:source:delta -r delta -m branch -k origin/master`
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    mode: flags.string({char: 'm',description: 'commitid|tags|branch', default:"commitid"}),
    deltakey: flags.string({char: 'k', description: 'commit id, tags prefix or name, branch name'}),
    retrievetestclass: flags.boolean({char: 'r', default:false,description: 'if true, retrieve dependent test classes'}),
    metatype:flags.string({char: 't',description: 'metatype comma separated, i.e.: objects,classes,workflows', default: 'objects,classes,workflows'}),
    basedir: flags.string({char: 'd', default:'force-app/main/default',description: 'path of base directory'}),
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
    let retrievetestclass = this.flags.retrievetestclass;
    let basedir = this.flags.basedir;
    let metatypes = this.flags.metatype.split(',');

    let deltaMeta = this.getDeltaChanges(mode,deltakey);
    //find dependent test classes
    if (retrievetestclass){ 
      //retrieve all classes
      fs.readdirSync( path.join(basedir, 'classes') ).forEach( (file:string) => {
        if (file.endsWith('.cls')) this.allClasses.push(file);
      }); 
      //go through delta changes
      deltaMeta.forEach( file => {
        file = path.parse(file);
        this.processedClasses = [];
        metatypes.forEach( type => {
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
    return {deltaMeta, testClasses: this.testClasses}
  }
  private getTestClasses(classpath, type, element){
      //check if the element is a test classes
      if (type === 'classes' && !this.testClasses.includes(element) && element.indexOf('Test') >= 0){
        this.testClasses.push(element);
        return;
      }
      //go through each classes and check if element is referenced in the file content (case senstive ?!)
      this.allClasses.forEach( f => {
        var file = path.parse( path.join(classpath,f) );
        if (!this.testClasses.includes(file.name)){
          var content = fs.readFileSync( path.join(classpath,f) ).toString();
          if (content.indexOf(element) >= 0 && !this.processedClasses.includes(file.name)){ //make sure we don't re-process a class already processed
            this.processedClasses.push(file.name);
            this.getTestClasses(classpath, 'classes', file.name);
          }
        }
      });
  }
  public getDeltaChanges(mode,deltakey):any{
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
    var files = gitresult.filter( onlyUnique );
    return files;
  }
}