import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxProject } from '@salesforce/core';
import { execSync as exec } from 'child_process';
import {
    registry,
    MetadataType,
    RegistryAccess,
    // @ts-ignore
} from '@salesforce/source-deploy-retrieve';
import * as path from 'path';
import * as fs from 'fs';

let basedir: string;
export default class extends SfdxCommand {

  public static description = 'This command generate delta package by doing git diff.';

  public static examples = [
    `$ sfdx dxb:source:delta -m tags -k mytag`,
    `$ sfdx dxb:source:delta -m branch -k origin/master`,
    `$ sfdx dxb:source:delta -m branch -k origin/master -p deltamanifest`,
    `$ sfdx dxb:source:delta -m commitid -k 123456`,
  ];

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    mode: flags.string({ char: 'm', description: 'commitid|tags|branch', default: "commitid" }),
    deltakey: flags.string({ char: 'k', description: 'commit id, tags prefix or name, branch name' }),
    basedir: flags.string({ char: 'd', description: 'path of base directory', default: 'force-app/main/default' }),
    outputpackage: flags.string({ char: 'p', description: 'output directory path of the delta package.xml to generate, i.e.: ./manifest' }),
    destructivechange: flags.boolean({ char: 'x', description: 'Indicate if need to generate destructivePackage.xml (experimental not working yet)', default: false })
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
  protected registryAccess:RegistryAccess = new RegistryAccess();
  protected packageJson: any = {
    '@': { xmlns: 'http://soap.sforce.com/2006/04/metadata' },
    types: []
  };

  public async run() {
    //project config
    const project = await SfdxProject.resolve();
    this.projectConfig = await project.resolveProjectConfig();
    //flags
    let mode = this.flags.mode;
    let deltakey = this.flags.deltakey;
    let outputpackage = this.flags.outputpackage;
    basedir = this.flags.basedir;
    let destructivechange = this.flags.destructivechange;
    //run delta
    let deltaMeta = this.getDeltaChanges(mode, deltakey);
    if (destructivechange) {
      let deleteFiles = this.getDeltaChanges(mode, deltakey, 'D');
      this.buildPackageXml(outputpackage, deleteFiles, 'destructiveChanges.xml');
    }
    //build package.xml ?   
    if (outputpackage) {
      return { deltaMeta: this.buildPackageXml(outputpackage, deltaMeta, 'package.xml') };
    }
    let deployOutput = '';
    if (deltaMeta && deltaMeta.length > 0) {
      deployOutput += `${deltaMeta.join(',')}`;
    }
    this.ux.log(deployOutput);
    return { deltaMeta }
  }
  /**
   * Build package.xml of for delta changes
   * @param outputpackage 
   * @param deltaMeta 
   * @param packageFileName 
   */
  private buildPackageXml(outputpackage, deltaMeta, packageFileName) {
    var js2xmlparser = require('js2xmlparser');
    this.packageJson.version = this.projectConfig.sourceApiVersion;

    //got to the list of file change and build package json { members: [], name: 'metadatatype_name'}
    deltaMeta.forEach(file => {
        file = path.parse(file);
        //split file directory path to find metadata type
        const metadataDir = file.dir.split(basedir).join('').split('/').filter(x => x != '');
        //find metadata suffix and file name
        const fileBase = file.base.split('-meta.xml')[0].split(new RegExp('\\.', 'g'));
        const fSuffix = fileBase.pop();
        const fName = fileBase.join('.');
        console.log('================================');
        console.log('File Detail:',file);
        console.log('Meta Detail:',fileBase,fSuffix);
        //try to get direct metadata base on file suffix only, anything that is not in registry.strictDirectoryNames
        let metadataType:MetadataType = this.registryAccess.getTypeBySuffix(fSuffix);
        if (metadataType){
            var tp = this.initMetadataTypeInPackage(metadataType);
            const metadataTypIndex = metadataDir.findIndex(x => metadataType.directoryName === x);
            //add member to packageJson, if inFolder, then need to add also the parent, if strictDirectory then add parent only
            if (metadataType.strictDirectoryName){
                this.addMemberToPackage(tp, metadataDir[metadataTypIndex + 1] ? metadataDir[metadataTypIndex + 1] : fName);
            }else{
                if (metadataType.inFolder && metadataDir[metadataTypIndex + 1] !== 'unfiled$public'){
                    this.addMemberToPackage(tp,metadataDir[metadataTypIndex + 1]);
                }
                this.addMemberToPackage(tp,`${metadataType.inFolder ? metadataDir[metadataTypIndex + 1] + '/' : ''}${fName}`);
            }
        }else { //suffix is not good enough to identify metadata let's try to find parent metadata folder. This is usually the case for cmp such as lwc, static resource,  aura, etc. 
            const metadataTypIndex = metadataDir.findIndex(x => registry.strictDirectoryNames[x] !== undefined);
            if (metadataTypIndex >= 0){
                metadataType = this.registryAccess.getTypeByName(registry.strictDirectoryNames[metadataDir[metadataTypIndex]]);
                var tp = this.initMetadataTypeInPackage(metadataType);
                //add member to packageJson, if inFolder, then need to add also the parent, if strictDirectory then add parent only
                if (metadataType.strictDirectoryName){
                    this.addMemberToPackage(tp, metadataDir[metadataTypIndex + 1] ? metadataDir[metadataTypIndex + 1] : fName);
                }else{
                    if (metadataType.inFolder && metadataDir[metadataTypIndex + 1] !== 'unfiled$public'){
                        this.addMemberToPackage(tp,metadataDir[metadataTypIndex + 1]);
                    }
                    this.addMemberToPackage(tp,`${metadataType.inFolder ? metadataDir[metadataTypIndex + 1] + '/' : ''}${fName}`);
                }
            }
        }
        });
        //write package.xml
        if (!fs.existsSync(outputpackage)) {
            fs.mkdirSync(outputpackage);
        }
        var xml = js2xmlparser.parse("Package", this.packageJson, { declaration: { encoding: 'UTF-8' } });
        fs.writeFileSync(path.join(outputpackage, packageFileName), xml);
  }
  /**
   * Initialise new metadata type in package json object 
   * @param metadataType Metadata type name
   * @returns array for passedmetadata type
   */
  private initMetadataTypeInPackage(metadataType:MetadataType){
    var tp = this.packageJson.types.find((t: any) => t.name === metadataType.name);
    if (!tp) {
        tp = {
            members: [],
            name: metadataType.name
        }
        this.packageJson.types.push(tp);
    }
    return tp;
  }
  /**
   * Add metadata member to package json specific metadata type
   * @param tp array of member for metadata type
   * @param memberName name of member
   */
  private addMemberToPackage(tp, memberName){
    if (!tp.members.includes(memberName))tp.members.push(memberName);
  }
  /**
   * Only keep unique files 
   * @param value file path 
   * @param index index in the array
   * @param self array
   * @returns filtered array
   */
  private onlyUnique(value: any, index: any, self: any) {
    return self.indexOf(value) === index && value.startsWith(basedir) && value.indexOf('lwc/jsconfig.json') < 0;
  }
  /**
   * Identify files that has changes in order to form delta
   * @param mode comparison mode : branch, tags, commitid
   * @param deltakey branch/commit id or tag to compare against
   * @param filter git filter, default to AMRU
   * @returns 
   */
  public getDeltaChanges(mode: any, deltakey: any, filter: string = 'AMRU'): any {
    var gitresult;
    if (mode === 'branch') {
      gitresult = exec(`git diff ${deltakey} --name-only --diff-filter=${filter}`).toString().split('\n');
    } else if (mode === 'tags') {
      if (deltakey) {
        gitresult = exec(`git diff $(git describe --match ${deltakey}* --abbrev=0 --all) --name-only --diff-filter=${filter}`).toString().split('\n');
      } else {
        gitresult = exec(`git diff $(git describe --tags --abbrev=0 --all) --name-only --diff-filter=${filter}`).toString().split('\n');
      }
    } else {
      gitresult = exec(`git diff --name-only ${deltakey} --diff-filter=${filter}`).toString().split('\n'); //this only work with specific commit ids, how to get file that changed since last tag ? 
    }
    //filter unnecessary files
    var files = gitresult.filter(this.onlyUnique);
    return files;
  }
}