/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import * as path from 'path';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, PackageDir, SfProject } from '@salesforce/core';
import { JsonMap } from '@salesforce/ts-types';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs-extra';

type ApexCoverageCleanupResult = {
  success: boolean;
};

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'apex.coverage.cleanup');

export default class ApexCoverageCleanup extends SfCommand<ApexCoverageCleanupResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'file-path': Flags.string({ char: 'f', summary: messages.getMessage('flags.file-path.summary'), required: true, aliases: ['file'], deprecateAliases: true }),
  };
  protected packageDirectories: string[] = [];
  protected allClasses: string[] = [];
  public async run(): Promise<ApexCoverageCleanupResult> {
    // flags
    const { flags } = await this.parse(ApexCoverageCleanup);
    const originFile = flags['file-path'];
    // project config
    const project: SfProject = await SfProject.resolve();
    const projectConfig: JsonMap = await project.resolveProjectConfig();
    this.packageDirectories = (projectConfig.packageDirectories as PackageDir[]).map( pkg => pkg.path);

    let fileContent: string = readFileSync(originFile).toString();
    const results = [...fileContent.matchAll(/filename=".*?"/g)];
    this.packageDirectories.forEach( (pkg) => {
      this.getAllClasses(pkg);
    });
    results.forEach((elem) => {
      const classnameString: string = elem[0];
      // classname = classname.split('filename="no-map').join('').slice(0, -1);
      // eslint-disable-next-line no-useless-escape
      // classname = classname.split(/filename="no-map[\/\\]/).join('').slice(0, -1);
      const classnameMatch = classnameString.match(/\\([^\\]+)$/); // Match the last part after the backslash
      const classname = classnameMatch ? classnameMatch[1].slice(0, -1) : undefined;
      if(classname){
        const classpath = this.allClasses.find((e: string) => this.isPathEndingWith(e,classname));
        fileContent = fileContent.split(`no-map\\${classname}`).join(classpath);
      }
    });
    writeFileSync(originFile, fileContent);
    return { success: true };
  }

  public isPathEndingWith(filename: string, classname: string): boolean {
    const expectedPath = path.join('classes', `${classname}.cls`);
    const fullPath = path.resolve(filename);
  
    return fullPath.endsWith(expectedPath);
  }

  public getAllClasses(directory: string): void {
    const currentDirectorypath = path.join(directory);

    const currentDirectory: string[] = readdirSync(currentDirectorypath, 'utf8');

    currentDirectory.forEach((file: string) => {
      const pathOfCurrentItem: string = path.join(directory + '/' + file);
      if (statSync(pathOfCurrentItem).isFile() && file.endsWith('.cls')) {
        this.allClasses.push(pathOfCurrentItem);
      } else if (!statSync(pathOfCurrentItem).isFile()) {
        const directorypath = path.join(directory + '/' + file);
        this.getAllClasses(directorypath);
      }
    });
  }
}
