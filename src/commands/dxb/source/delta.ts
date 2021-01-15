import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxProject } from '@salesforce/core';
import {execSync as exec} from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

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
    outputpackage: flags.string({ char: 'p', description: 'output path of the package.xml to generate, i.e.: ./manifest'}),
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
  protected projectConfig;

  public async run() {
    //project config
    const project = await SfdxProject.resolve();
    this.projectConfig = await project.resolveProjectConfig();
    //flags
    let mode = this.flags.mode;
    let deltakey = this.flags.deltakey;
    let outputpackage = this.flags.outputpackage;
    this.regex = this.flags.testclsnameregex;
    basedir = this.flags.basedir;
    //run delta
    let deltaMeta = this.getDeltaChanges(mode, deltakey);
    //build package.xml ?   
    if (outputpackage){
      return {deltaMeta:this.buildPackageXml(outputpackage,deltaMeta)};
    }
    let deployOutput = '';
    if (deltaMeta && deltaMeta.length > 0) {
      deployOutput += `${deltaMeta.join(',')}`;
    } 
    this.ux.log(deployOutput);
    return { deltaMeta }
  }
  private buildPackageXml(outputpackage,deltaMeta){
    var js2xmlparser = require('js2xmlparser');
    var metadataConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../lib/metadata-def.json')).toString());
    var packageJson:any = {
      '@': { xmlns: 'http://soap.sforce.com/2006/04/metadata' },
      'version' : this.projectConfig.sourceApiVersion,
      types : []
    };
    var requiredParent = ['Report','Dashboard', 'EmailTemplate','Document']
    var requiredParentOnly = ['LightningComponentBundle','AuraDefinitionBundle', 'StaticResource','CustomObject','ExperienceBundle'];
    //transform here
    deltaMeta.forEach(file => {
      file = path.parse(file);
      var metadataDir = file.dir.split(basedir).join('').split('/').filter( x => x != '');
      if (metadataConfig[metadataDir[0]]){
        var metaType = metadataConfig[metadataDir[0]];
        var fileName = file.name.split(new RegExp('\\.','g'))[0];
        var tp = packageJson.types.find((t:any) => t.name === metaType);
        if (!tp){
          tp = {
            members:[],
            name : metaType
          }
          packageJson.types.push(tp);
        }
        if ( (requiredParent.includes(metaType) && metadataDir[1]) || requiredParentOnly.includes(metaType)){
          if(!tp.members.includes(metadataDir[1]))tp.members.push(metadataDir[1]);
          fileName = metadataDir[1] +'/'+fileName;
        }
        if (!tp.members.includes(fileName) && !requiredParentOnly.includes(metaType)) tp.members.push(fileName);
      }
    });
    //write package.xml
    if (!fs.existsSync(outputpackage)) {
        fs.mkdirSync(outputpackage);
    }
    var xml = js2xmlparser.parse("Package", packageJson, { declaration: { encoding: 'UTF-8' }});
    fs.writeFileSync(outputpackage+'/package.xml', xml);
  }
  private onlyUnique(value: any, index: any, self: any) {
    return self.indexOf(value) === index && value.startsWith(basedir) && value.indexOf('lwc/jsconfig.json') < 0;
  }
  public getDeltaChanges(mode: any, deltakey: any): any {
    var gitresult;
    if (mode === 'branch') {
      gitresult = exec(`git diff ${deltakey} --name-only --diff-filter=AMR`).toString().split('\n');
    } else if (mode === 'tags') {
      if (deltakey) {
        gitresult = exec(`git diff $(git describe --match ${deltakey}* --abbrev=0 --all)..HEAD --name-only --diff-filter=AMR`).toString().split('\n');
      } else {
        gitresult = exec(`git diff $(git describe --tags --abbrev=0 --all)..HEAD --name-only --diff-filter=AMR`).toString().split('\n');
      }
    } else {
      gitresult = exec(`git diff --name-only ${deltakey} --diff-filter=AMR`).toString().split('\n'); //this only work with specific commit ids, how to get file that changed since last tag ? 
    }
    //filter unnecessary files
    var files = gitresult.filter(this.onlyUnique);
    return files;
  }
}