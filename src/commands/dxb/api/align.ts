import * as path from 'path';
import {Flags, SfCommand} from '@salesforce/sf-plugins-core';
import { Messages, PackageDir, SfProject} from '@salesforce/core';

import * as xml2js from 'xml2js';
import * as js2xmlparser from 'js2xmlparser';
import * as fs from 'fs-extra';

type ApiAlignResult = {
  success: boolean;
}

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'api.align');

export default class ApiAlign extends SfCommand<ApiAlignResult> {

  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'metadata-type': Flags.string({
      char: 'm',
      summary: messages.getMessage('flags.metadata-type.summary'),
      description: messages.getMessage('flags.metadata-type.description'),
      multiple: true
    }),
    'directory': Flags.string({
      char: 'd',
      summary: messages.getMessage('flags.directory.summary'),
      description: messages.getMessage('flags.directory.description'),
      multiple: true
    })
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  public static readonly requiresProject = true;

  public async run(): Promise<ApiAlignResult> {
    const {flags} = await this.parse(ApiAlign);
    const projectConfig: any = await (await SfProject.resolve()).resolveProjectConfig();
    const projectApi: string = projectConfig.sourceApiVersion!;
    const directories: string[] = flags.directory ?? projectConfig.packageDirectories.map((packageDir: PackageDir) => packageDir.path);
    const metadataTypes: string[] | undefined = flags['metadata-type'];
    const apiAlignmentExclusion: string[] = projectConfig.plugins.dxb.apiAlignmentExclusion || [];

    // for every package directory, find all XML files that have a tag <apiVersion> and return the full path
    directories.forEach( (rootPath: string) => {
      const filesWithApi: string[] = !fs.lstatSync(rootPath).isDirectory()
        ? [ rootPath ]
        : this.findFilesWithTag(rootPath, 'apiVersion').filter((f: string) => !apiAlignmentExclusion.includes(f));
      // for every file with the required tag, read it and update the value of the tag to the project api
      filesWithApi.forEach(( f: string ) => {
        this.processFile(f, projectApi, metadataTypes);
      });
    });
    return { success: true };
  }
  
  /**
   * Recursive search for XML files with specific tag
   *
   * @param filePath The path to a file or directory
   * @param tag The tag that an xml file must contain to be selected
   * @returns string[]: an Array containing file paths to xml files that contain a specific tags
   */
  public findFilesWithTag(filePath: string, tag: string): any {
    if (fs.lstatSync(filePath).isDirectory()) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return fs.readdirSync(filePath).flatMap((entry: string) => this.findFilesWithTag(`${filePath}/${entry}`, tag)).filter(e => e !== undefined);
    } else if (path.extname(filePath) === '.xml' && fs.readFileSync(filePath, { encoding: 'utf-8'}).includes(tag)) {
      return filePath;
    } else {
      return;
    }
  }

  /**
   * Process one file to update the apiVersion tag
   *
   * @param filePath The path to a file
   * @param projectApi The API version of the sfdx-project.json
   * @param metadataTypes The list of Metadata Types that need to be aligned (optional)
   */
  private processFile(filePath: string, projectApi: string, metadataTypes?: string[]): void {
    const fileContent: string = fs.readFileSync(filePath, { encoding: 'utf-8' });
    const parser = new xml2js.Parser({ explicitArray: false });
    parser.parseString(fileContent, (err, result) => {
      if (err) {
        this.error(err.message);
      } else if (result) {
        const root = Object.keys(result)[0];
        if (metadataTypes?.includes(root) === false) { // in case specific metadata types are wanted, skip if this type is not one of them
          return;
        }
        delete result[root]['$'];
        result[root]['@'] = {
          xmlns: 'http://soap.sforce.com/2006/04/metadata'
        };
        this.log(`Change API Version of ${filePath} from ${result[root].apiVersion} to ${projectApi}`);
        result[root].apiVersion = projectApi;
        const xml = js2xmlparser.parse(
          root,
          result[root],
          {
            declaration: { encoding: 'UTF-8' },
            format: {
              doubleQuotes: true
            }
          });
        fs.writeFileSync(filePath, xml);
      }
    });
  }
}