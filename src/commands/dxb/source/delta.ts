import { execSync as exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import {
  registry,
  MetadataType,
  RegistryAccess,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
} from '@salesforce/source-deploy-retrieve';
import * as js2xmlparser from 'js2xmlparser';
import { Messages, PackageDir, SfProject } from '@salesforce/core';
import { JsonMap } from '@salesforce/ts-types';

export type SourceDeltaResult = {
  deltaMeta: string[];
};
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'source.delta');

export default class SourceDelta extends SfCommand<SourceDeltaResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    mode: Flags.string({
      char: 'm',
      summary: messages.getMessage('flags.mode.summary'),
      default: 'commitid',
      options: ['commitid', 'tags', 'branch'],
    }),
    'delta-key': Flags.string({
      char: 'k',
      summary: messages.getMessage('flags.delta-key.summary'),
      required: true,
      aliases: ['deltakey'],
      deprecateAliases: true,
    }),
    'base-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.base-dir.summary'),
      exists: true,
      default: 'force-app/main/default',
      deprecated: true,
      aliases: ['basedir'],
      deprecateAliases: true,
    }),
    'output-dir': Flags.directory({
      char: 'p',
      summary: messages.getMessage('flags.output-dir.summary'),
      exists: false,
      default: 'manifest',
      aliases: ['outputpackage'],
      deprecateAliases: true,
    }),
    granular: Flags.boolean({
      char: 'g',
      summary: messages.getMessage('flags.granular.summary'),
      default: false,
      aliases: ['granularmode'],
      deprecateAliases: true,
    }),
    'destructive-changes': Flags.boolean({
      char: 'x',
      summary: messages.getMessage('flags.destructive-changes.summary'),
      default: false,
      hidden: true,
      aliases: ['destructivechange'],
      deprecateAliases: true,
    }),
    rollback: Flags.boolean({
      char: 'r',
      summary: messages.getMessage('flags.rollback.summary'),
      default: false,
    }),
  };

  public static readonly requiresProject = true;

  protected testClasses: string[] = [];
  protected allClasses: string[] = [];
  protected processedClasses: string[] = [];
  protected projectConfig!: JsonMap;
  protected registryAccess: RegistryAccess = new RegistryAccess();
  protected packageJson: any = {
    '@': { xmlns: 'http://soap.sforce.com/2006/04/metadata' },
    types: [],
  };
  protected granularmode = false;
  protected packageDirectories: PackageDir[] = [];
  protected basedir = '';
  public async run(): Promise<SourceDeltaResult> {
    const { flags } = await this.parse(SourceDelta);
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    const mode: 'tags' | 'branch' | 'commitid' | string = flags.mode;
    if (mode !== 'tags' && mode !== 'branch' && mode !== 'commitid') {
      throw messages.createError('error.invalidMode', [mode]);
    }
    const deltakey = flags['delta-key'];
    const outputDir = flags['output-dir'];
    // project config
    const project: SfProject = await SfProject.resolve();
    this.projectConfig = await project.resolveProjectConfig();
    this.packageDirectories = this.projectConfig.packageDirectories as PackageDir[];
    this.granularmode = flags.granular;
    this.basedir = fs.existsSync(flags['base-dir']) ? flags['base-dir'] : '';
    // flags
    let filter = 'AMRU';
    if (flags['destructive-changes']) {
      const deleteFiles = this.getDeltaChanges(mode, deltakey, 'D');
      await this.buildPackageXml(outputDir, deleteFiles, 'destructiveChanges.xml');
    } else if (flags.rollback) {
      const deleteFiles = this.getDeltaChanges(mode, deltakey, 'D');
      await this.buildPackageXml(outputDir, deleteFiles, 'destructiveChanges.xml');
      filter = 'MRD';
    }
    // run delta
    const deltaMeta: string[] = this.getDeltaChanges(mode, deltakey, filter);
    // build package.xml ?
    if (outputDir) {
      return { deltaMeta: await this.buildPackageXml(outputDir, deltaMeta, 'package.xml') };
    }
    let deployOutput = '';
    if (deltaMeta && deltaMeta.length > 0) {
      deployOutput += `${deltaMeta.join(',')}`;
    }
    this.log(deployOutput);
    return { deltaMeta };
  }
  /**
   * Build package.xml of for delta changes
   *
   * @param outputDir
   * @param deltaMeta
   * @param packageFileName
   */
  private async buildPackageXml(outputDir: string, deltaMeta: string[], packageFileName: string): Promise<string[]> {
    this.packageJson.version = this.projectConfig.sourceApiVersion;
    deltaMeta = await this.processAllFiles(deltaMeta);
    this.writePackageFile(outputDir, packageFileName);
    return deltaMeta;
  }
  /**
   * Processes all the metadata files in the deltaMeta array for the package.
   *
   * @param {Array<string>} deltaMeta - An array of metadata files to process.
   * @returns {Promise<Array<any>>} A promise that resolves with the updated deltaMeta array.
   */
  private async processAllFiles(deltaMeta: string[]): Promise<string[]> {
    return Promise.all(
      deltaMeta
        .filter((f) => fs.existsSync(f))
        // eslint-disable-next-line @typescript-eslint/require-await
        .map(async (f) => {
          this.processMetadataFileForPackage(f);
          return f;
        })
    );
  }
  /**
   * initialise the package xml file based on given name and path.
   *
   * @param outputDir path of the output directory
   * @param packageFileName name of the manifest file
   */
  private writePackageFile(outputDir: string, packageFileName: string): void {
    fs.ensureDirSync(outputDir);
    const xml = js2xmlparser.parse('Package', this.packageJson, { declaration: { encoding: 'UTF-8' } });
    fs.writeFileSync(path.join(outputDir, packageFileName), xml);
  }
  /**
   * Split metadata file path in order to detect metadata type name (i.e. objects, classes).
   *
   * @param f path of the metadata file.
   * @returns list representation of the path
   */
  private getMetadataDir(f: string): string[] {
    const p = this.basedir ? { path: this.basedir } : this.packageDirectories.find((e) => f.startsWith(e.path));
    return (
      (p &&
        f
          .split(p.path)
          .join('')
          .split('/')
          .filter((x) => x !== '')) ??
      []
    );
  }
  /**
   * Get Metadata Type based on the name of suffix of the file (i.e.: CustomObject for .object-meta.xml)
   *
   * @param f path of the metadata file.
   * @returns metadata type object including suffix and name of the file
   */
  private getMetadataTypeAndName(f: string): {
    metadataType: MetadataType | undefined;
    fName: string;
    fSuffix: string;
  } {
    const fileBase: string[] = f.split('-meta.xml')[0].split(new RegExp('\\.', 'g'));
    const fSuffix: string = fileBase.pop() ?? '';
    const fName: string = fileBase.join('.');
    const metadataType: MetadataType | undefined = this.registryAccess.getTypeBySuffix(fSuffix);
    if (
      (metadataType && fSuffix !== 'site' && fSuffix !== 'md') ??
      (metadataType && fSuffix === 'md' && f.endsWith('-meta.xml'))
    ) {
      return { metadataType, fName, fSuffix };
    }
    return { metadataType, fName, fSuffix };
  }
  /**
   * Processes a file and determines its metadata type and name. Adds it to the packageJson object
   *
   * @param {any} file - The file to be processed
   * @returns {Promise<void>} - A promise that resolves with void once the file has been processed and added to packageJson
   */
  // eslint-disable-next-line complexity
  private processMetadataFileForPackage(file: any): void {
    const { dir, base } = path.parse(file);
    // split file directory path to find metadata type
    const metadataDir = this.getMetadataDir(dir);
    // find metadata suffix and file name
    // eslint-disable-next-line prefer-const
    let { metadataType, fName, fSuffix } = this.getMetadataTypeAndName(base);

    if (
      (metadataType && fSuffix !== 'site' && fSuffix !== 'md') ??
      (metadataType && fSuffix === 'md' && base.endsWith('-meta.xml'))
    ) {
      const tp = this.initMetadataTypeInPackage(metadataType.name);
      const metadataTypIndex = metadataDir.findIndex((x) => metadataType?.directoryName === x);
      // add member to packageJson, if inFolder, then need to add also the parent, if strictDirectory then add parent only
      if (metadataType.strictDirectoryName) {
        this.addMemberToPackage(tp, metadataDir[metadataTypIndex + 1] ? metadataDir[metadataTypIndex + 1] : fName);
      } else {
        if (metadataType.folderType && metadataDir[metadataTypIndex + 1] !== 'unfiled$public') {
          this.addMemberToPackage(tp, metadataDir[metadataTypIndex + 1]);
        }
        this.addMemberToPackage(
          tp,
          `${metadataType.folderType ? metadataDir[metadataTypIndex + 1] + '/' : ''}${fName}`
        );
      }
    } else if (metadataDir) {
      // suffix is not good enough to identify metadata let's try to find parent metadata folder. This is usually the case for cmp such as lwc, static resource,  aura, etc.
      const metadataTypIndex = metadataDir.findIndex(
        (x) => !!Object.prototype.hasOwnProperty.call(registry.strictDirectoryNames, x)
      );
      if (metadataTypIndex >= 0) {
        metadataType = this.registryAccess.getTypeByName(metadataDir[metadataTypIndex]);
        if (metadataType.name === 'CustomObject' && fSuffix !== 'object' && this.granularmode) {
          const tp = this.initMetadataTypeInPackage(
            metadataType.children!.types[metadataType.children!.suffixes[fSuffix]].name
          );
          this.addMemberToPackage(tp, metadataDir[metadataTypIndex + 1] + '.' + fName);
          // add member to packageJson, if inFolder, then need to add also the parent, if strictDirectory then add parent only
        } else {
          const tp = this.initMetadataTypeInPackage(metadataType.name);
          if (metadataType.strictDirectoryName) {
            this.addMemberToPackage(tp, metadataDir[metadataTypIndex + 1] ? metadataDir[metadataTypIndex + 1] : fName);
          } else {
            if (metadataType.folderType && metadataDir[metadataTypIndex + 1] !== 'unfiled$public') {
              this.addMemberToPackage(tp, metadataDir[metadataTypIndex + 1]);
            }
            this.addMemberToPackage(
              tp,
              `${metadataType.folderType ? metadataDir[metadataTypIndex + 1] + '/' : ''}${fName}`
            );
          }
        }
      }
    }
  }
  /**
   * Initialise new metadata type in package json object
   *
   * @param metadataType Metadata type name
   * @returns array for passedmetadata type
   */
  private initMetadataTypeInPackage(metadataType: string): { members: string[]; name: string } {
    let tp: { members: string[]; name: string } = this.packageJson.types.find((t: any) => t.name === metadataType);
    if (!tp) {
      tp = {
        members: [],
        name: metadataType,
      };
      this.packageJson.types.push(tp);
    }
    return tp;
  }
  /**
   * Add metadata member to package json specific metadata type
   *
   * @param tp array of member for metadata type
   * @param memberName name of member
   */
  // eslint-disable-next-line class-methods-use-this
  private addMemberToPackage(tp: { members: string[]; name: string }, memberName: string): void {
    if (!tp.members.includes(memberName)) {
      tp.members.push(memberName);
    }
  }
  /**
   * Identify files that has changes in order to form delta
   *
   * @param mode comparison mode : branch, tags, commitid
   * @param deltakey branch/commit id or tag to compare against
   * @param filter git filter, default to AMRU
   * @returns
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  private getDeltaChanges(mode: 'branch' | 'tags' | 'commitid', deltakey: string, filter = 'AMRU'): string[] {
    const commandMap = {
      branch: `git diff ${deltakey} --name-only --diff-filter=${filter}`,
      tags: deltakey
        ? `git diff $(git describe --match ${deltakey}* --abbrev=0 --all) --name-only --diff-filter=${filter}`
        : `git diff $(git describe --tags --abbrev=0 --all) --name-only --diff-filter=${filter}`,
      commitid: `git diff --name-only ${deltakey} --diff-filter=${filter}`,
    };
    const command: string = commandMap[mode] || commandMap.commitid;
    const gitresult = exec(command).toString().split('\n'); // this only work with specific commit ids, how to get file that changed since last tag ?
    return this.filterUniqueForceAppFiles(gitresult);
  }
  /**
   * Only keep unique files
   *
   * @param value file path
   * @param index index in the array
   * @param self array
   * @returns filtered array
   */
  private filterUniqueForceAppFiles(filePaths: string[]): string[] {
    const filteredFiles = filePaths.filter(
      (f) =>
        ((!!this.basedir && f.startsWith(this.basedir)) ||
          (!this.basedir && this.packageDirectories.some((p) => f.startsWith(p.path)))) &&
        !f.includes('lwc/jsconfig.json')
    );
    const uniqueFiles = [...new Set(filteredFiles)];
    return uniqueFiles;
  }
}
