import { SfdxCommand } from "@salesforce/command";
import { SfdxProject, PackageDir} from "@salesforce/core";

import * as xml2js from "xml2js";
import * as js2xmlparser from "js2xmlparser";
import * as fs from "fs-extra";
import * as path from 'path';

export default class ApiAlign extends SfdxCommand {

  public static description = 'Align the API version of components with the API version defined in sfdx-project.json';

  public static examples = [
    `$ sfdx dxb api align`
  ];

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  protected projectConfig;

  public async run() {
    this.projectConfig = await (await SfdxProject.resolve()).resolveProjectConfig();
    const projectApi: string = this.projectConfig.sourceApiVersion;
    const packageDirs: PackageDir[] = this.projectConfig.packageDirectories;

    // for every package directory, find all XML files that have a tag <apiVersion> and return the full path
    packageDirs.forEach(( packageDir : PackageDir ) => {
      const filesWithApi : string[] = this.findFilesWithTag(packageDir.path, 'apiVersion');
      // for every file with the required tag, read it and update the value of the tag to the project api
      filesWithApi.forEach(( f:string ) => {
        const fileContent : string = fs.readFileSync(f, { encoding: 'utf-8'});
        const parser = new xml2js.Parser({ explicitArray : false });
        parser.parseString(fileContent, function (err, result) {
          if (err) {
            console.error(err);
          } else if (result) {
            const root = Object.keys(result)[0];
            delete result[root]["$"];
            result[root]["@"] = {
              xmlns: "http://soap.sforce.com/2006/04/metadata"
            };
            console.log(`Change API Version of ${f} from ${result[root].apiVersion} to ${projectApi}`);
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
            fs.writeFileSync(f, xml);
          }
        });
      });
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