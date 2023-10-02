import * as path from 'path';
import {Flags, SfCommand} from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs-extra';

type CoverageCleanupResult = {
  success: boolean;
}

const allClasses: string[] = [];

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'apex.coverage.cleanup');

export default class CoverageCleanup extends SfCommand<CoverageCleanupResult> {

  public static readonly summary = messages.getMessage('summary');

  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'file-path': Flags.string({ char: 'f', summary: messages.getMessage('flags.file-path.summary'), required:true})
  };

  public async run(): Promise<CoverageCleanupResult> {
    // flags
    const {flags} = await this.parse(CoverageCleanup);
    const originFile = flags['file-path'];
    let fileContent: string = readFileSync(originFile).toString();
    const results = [...fileContent.matchAll(/filename=".*?"/g)];
    this.getAllClasses('.');
    results.forEach(elem => {
      let classname = elem[0];
      classname = classname.split('filename="no-map/').join('').slice(0, -1);
      const classpath = allClasses.find((e: string) => e.endsWith(`/classes/${classname}.cls`));
      fileContent = fileContent.split(`no-map/${classname}`).join(classpath);
    });
    writeFileSync(originFile, fileContent);
    return { success: true };
  }

  public getAllClasses(directory: string): void {
		const currentDirectorypath = path.join(directory);

		const currentDirectory: string[] = readdirSync(currentDirectorypath, 'utf8');

		currentDirectory.forEach((file: string) => {
			const pathOfCurrentItem: string = path.join(directory + '/' + file);
			if (statSync(pathOfCurrentItem).isFile() && file.endsWith('.cls')) {
				allClasses.push(pathOfCurrentItem);
			} else if (!statSync(pathOfCurrentItem).isFile()) {
				const directorypath = path.join(directory + '/' + file);
				this.getAllClasses(directorypath);
			}
		});
	}
}