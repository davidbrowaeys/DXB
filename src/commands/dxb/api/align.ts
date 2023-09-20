import { SfdxCommand } from "@salesforce/command";
import { SfdxProject } from "@salesforce/core";

export default class ApiAlign extends SfdxCommand {

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  protected projectConfig;

  public async run() {
    this.projectConfig = await  (await SfdxProject.resolve()).resolveProjectConfig();
    const projectApi = this.projectConfig.sourceApiVersion;
  }
}