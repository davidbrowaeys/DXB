import { SfdxCommand, flags } from "@salesforce/command";
import { SfdxProject, PackageDir} from "@salesforce/core";

import * as xml2js from "xml2js";
import * as js2xmlparser from "js2xmlparser";
import * as fs from "fs-extra";
import * as path from 'path';

export default class ApiAlign extends SfdxCommand {

  public static description = 'Align the API version of components with the API version defined in sfdx-project.json';

  public static examples = [
    `$ sfdx dxb api align`,
    `$ sfdx dxb api align -m ApexClass`,
    `$ sfdx dxb api align --metadata-type ApexClass --metadata-type ApexTrigger`
  ];

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    'metadata-type': flags.string({
      char: 'm',
      description: 'Select specific metadata type to align, value is the name of the root tag of the XML file holding the apiVersion tag i.e. <ApexClass ...',
      multiple: true
    })
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  protected projectConfig;

  public async run() {
    this.projectConfig = await (await SfdxProject.resolve()).resolveProjectConfig();
    const projectApi: string = this.projectConfig.sourceApiVersion;
    const packageDirs: PackageDir[] = this.projectConfig.packageDirectories;
    const metadataTypes: string[] = this.flags['metadata-type'];
    const apiAlignmentExclusion: string[] = this.projectConfig.plugins.dxb.apiAlignmentExclusion || [];

    // for every package directory, find all XML files that have a tag <apiVersion> and return the full path
    packageDirs.forEach(( packageDir : PackageDir ) => {
      const filesWithApi : string[] = this.findFilesWithTag(packageDir.path, 'apiVersion').filter((f:string) => !apiAlignmentExclusion.includes(f));
      // for every file with the required tag, read it and update the value of the tag to the project api
      filesWithApi.forEach(( f:string ) => {
        this.processFile(f, projectApi, metadataTypes);
      });
    });
  }

  /**
   * Process one file to update the apiVersion tag
   * @param filePath The path to a file
   * @param projectApi The API version of the sfdx-project.json
   * @param metadataTypes The list of Metadata Types that need to be aligned (optional)
   */
  private processFile(filePath: string, projectApi : string, metadataTypes? : string[]) {
    const fileContent: string = fs.readFileSync(filePath, { encoding: 'utf-8' });
    const parser = new xml2js.Parser({ explicitArray: false });
    parser.parseString(fileContent, function (err, result) {
      if (err) {
        console.error(err);
      } else if (result) {
        const root = Object.keys(result)[0];
        if (metadataTypes?.includes(root) === false) { // in case specific metadata types are wanted, skip if this type is not one of them
          return;
        }
        delete result[root]["$"];
        result[root]["@"] = {
          xmlns: "http://soap.sforce.com/2006/04/metadata"
        };
        console.log(`Change API Version of ${filePath} from ${result[root].apiVersion} to ${projectApi}`);
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

  /**
   * Recursive search for XML files with specific tag
   * @param filePath The path to a file or directory
   * @param tag The tag that an xml file must contain to be selected
   * @returns string[]: an Array containing file paths to xml files that contain a specific tags
   */
  public findFilesWithTag(filePath: string, tag: string) {
    if (fs.lstatSync(filePath).isDirectory()) {
      return fs.readdirSync(filePath).flatMap((entry : string) => this.findFilesWithTag(`${filePath}/${entry}`, tag)).filter((e : string) => e !== undefined);
    } else if (path.extname(filePath) === '.xml' && fs.readFileSync(filePath, { encoding: 'utf-8'}).indexOf(tag) !== -1) {
      return filePath;
    } else {
      return;
    }
  }
}