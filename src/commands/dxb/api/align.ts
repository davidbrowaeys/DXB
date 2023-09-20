import { SfdxCommand } from "@salesforce/command";
import { SfdxProject } from "@salesforce/core";

export default class ApiAlign extends SfdxCommand {

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