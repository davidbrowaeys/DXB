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
import * as js2xmlparser from 'js2xmlparser';

interface PackageDirectory {
  path: string;
  default: boolean;
}

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
    basedir: flags.string({ char: 'd', description: 'path of base directory(deprecated)', default: 'force-app/main/default' }),
    outputpackage: flags.string({ char: 'p', description: 'output directory path of the delta package.xml to generate, i.e.: ./manifest' }),
    granularmode: flags.boolean({ char: 'g', description: 'If true, then delta will be very granular for Custom Object, otherwise will deploy the whole object', default: false}),
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
  protected granularmode:boolean;
  protected packageDirectories: PackageDirectory[] = [];

  public async run() {
    let { mode, deltakey, outputpackage, destructivechange, rollback } = this.flags;
    //project config
    this.projectConfig = await  (await SfdxProject.resolve()).resolveProjectConfig();
    this.packageDirectories = this.projectConfig.packageDirectories;
    this.granularmode = this.flags.granularmode;
    //flags
    let filter = 'AMRU';
    if (destructivechange) {
      let deleteFiles = this.getDeltaChanges(mode, deltakey, 'D');
      await this.buildPackageXml(outputpackage, deleteFiles, 'destructiveChanges.xml');
    }else if (rollback) {
      let deleteFiles = this.getDeltaChanges(mode, deltakey, 'D');
      await this.buildPackageXml(outputpackage, deleteFiles, 'destructiveChanges.xml');
      filter = 'MRD';
    }
    //run delta
    let deltaMeta:string[] = this.getDeltaChanges(mode, deltakey, filter);
    //build package.xml ?   
    if (outputpackage) {
      return { deltaMeta: await this.buildPackageXml(outputpackage, deltaMeta, 'package.xml') };
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
  private async buildPackageXml(outputpackage:any, deltaMeta:string[], packageFileName:any) {
    this.packageJson.version = this.projectConfig.sourceApiVersion;
    deltaMeta = await this.processAllFiles(deltaMeta);
    await this.writePackageFile(outputpackage, packageFileName);
  }
  /**
   * Processes all the metadata files in the deltaMeta array for the package.
   *
   * @param {Array<string>} deltaMeta - An array of metadata files to process.
   * @returns {Promise<Array<any>>} A promise that resolves with the updated deltaMeta array.
   */
  private async processAllFiles(deltaMeta: string[]): Promise<any[]> {
    return Promise.all(deltaMeta.map(async (f) => {
      if (fs.existsSync(f)) {
        await this.processMetadataFileForPackage(f);
        return f;
      }
    }));
  }
  /**
   * initialise the package xml file based on given name and path.
   * @param outputpackage path of the output directory
   * @param packageFileName name of the manifest file
   */
  private async writePackageFile(outputpackage:string, packageFileName:string){
    if (!fs.existsSync(outputpackage)) {
      fs.mkdirSync(outputpackage);
    }
    let xml = js2xmlparser.parse("Package", this.packageJson, { declaration: { encoding: 'UTF-8' } });
    fs.writeFileSync(path.join(outputpackage, packageFileName), xml);
  }
  /**
   * Split metadata file path in order to detect metadata type name (i.e. objects, classes). 
   * @param f path of the metadata file.
   * @returns list representation of the path
   */
  private getMetadataDir(f: string): string[] {
    const p = this.packageDirectories.find( e => f.startsWith(e.path));
    return p && f.split(p.path).join('').split('/').filter(x => x !== '');
  }
  /**
   * Get Metadata Type based on the name of suffix of the file (i.e.: CustomObject for .object-meta.xml)
   * @param f path of the metadata file.
   * @returns metadata type object including suffix and name of the file
   */
  private getMetadataTypeAndName(f: string): { metadataType: MetadataType | undefined, fName: string, fSuffix:string } {
    let fileBase: string[] = f.split('-meta.xml')[0].split(new RegExp('\\.', 'g'));
    let fSuffix: string = fileBase.pop();
    let fName: string = fileBase.join('.');
    let metadataType: MetadataType = this.registryAccess.getTypeBySuffix(fSuffix);
    if ((metadataType && fSuffix !== 'site' && fSuffix !== 'md') || (metadataType && fSuffix === 'md' && f.endsWith('-meta.xml'))) {
      return { metadataType, fName, fSuffix };
    }
    return { metadataType, fName, fSuffix };
  }
  /**
  * Processes a file and determines its metadata type and name. Adds it to the packageJson object
  * @param {any} file - The file to be processed
  * @returns {Promise<void>} - A promise that resolves with void once the file has been processed and added to packageJson
  */
  private async processMetadataFileForPackage(file: any): Promise<void> {
    const { dir, base } = path.parse(file);
    //split file directory path to find metadata type
    const metadataDir = this.getMetadataDir(dir);
    //find metadata suffix and file name
    let { metadataType, fName, fSuffix } = this.getMetadataTypeAndName(base);
    if ((metadataType && fSuffix !== 'site' && fSuffix !== 'md') || (metadataType && fSuffix == 'md' && base.endsWith('-meta.xml'))){
        let tp = this.initMetadataTypeInPackage(metadataType.name);
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
    }else if (metadataDir){ //suffix is not good enough to identify metadata let's try to find parent metadata folder. This is usually the case for cmp such as lwc, static resource,  aura, etc. 
        const metadataTypIndex = metadataDir.findIndex(x => registry.strictDirectoryNames[x] !== undefined);
        if (metadataTypIndex >= 0){
            metadataType = this.registryAccess.getTypeByName(registry.strictDirectoryNames[metadataDir[metadataTypIndex]]);
            if(metadataType.name === 'CustomObject' && fSuffix != "object" && this.granularmode){
              var tp = this.initMetadataTypeInPackage(metadataType.children.types[metadataType.children.suffixes[fSuffix]].name);
              this.addMemberToPackage(tp, metadataDir[metadataTypIndex + 1] + '.' + fName);
            //add member to packageJson, if inFolder, then need to add also the parent, if strictDirectory then add parent only
            }else{
              let tp = this.initMetadataTypeInPackage(metadataType.name);
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
    }
  }
  /**
   * Initialise new metadata type in package json object 
   * @param metadataType Metadata type name
   * @returns array for passedmetadata type
   */
  private initMetadataTypeInPackage(metadataType:String){
    let tp = this.packageJson.types.find((t: any) => t.name === metadataType);
    if (!tp) {
        tp = {
            members: [],
            name: metadataType
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
   * Identify files that has changes in order to form delta
   * @param mode comparison mode : branch, tags, commitid
   * @param deltakey branch/commit id or tag to compare against
   * @param filter git filter, default to AMRU
   * @returns 
   */
  public getDeltaChanges(mode: 'branch' | 'tags' | string, deltakey: string, filter: string = 'AMRU'): string[] {
    const commandMap = {
      branch: `git diff ${deltakey} --name-only --diff-filter=${filter}`,
      tags: deltakey
        ? `git diff $(git describe --match ${deltakey}* --abbrev=0 --all) --name-only --diff-filter=${filter}`
        : `git diff $(git describe --tags --abbrev=0 --all) --name-only --diff-filter=${filter}`,
      default: `git diff --name-only ${deltakey} --diff-filter=${filter}`
    };
    const command = commandMap[mode] || commandMap.default;
    const gitresult = exec(command).toString().split('\n'); //this only work with specific commit ids, how to get file that changed since last tag ? 
    return this.filterUniqueForceAppFiles(gitresult);
  }
  /**
   * Only keep unique files 
   * @param value file path 
   * @param index index in the array
   * @param self array
   * @returns filtered array
   */
  private filterUniqueForceAppFiles(filePaths: string[]): string[] {
    const filteredFiles = filePaths.filter(filePath => this.packageDirectories.some((path) => filePath.startsWith(filePath)) && filePath.indexOf('lwc/jsconfig.json') < 0);
    const uniqueFiles = [...new Set(filteredFiles)];
    return uniqueFiles;
  }
}