import * as path from 'path';
import * as fs from 'fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, PackageDir, SfProject } from '@salesforce/core';
import { ux } from '@oclif/core';
import { readdirSync, statSync } from 'fs-extra';

const SOQL_REGEX = /\[SELECT\s.*?\]|\('(SELECT|select).*'\)/g;

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'apex.scan.query');

export default class Query extends SfCommand<void> {

  public static readonly summary = messages.getMessage('summary');

  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {'target-org': Flags.requiredOrg()};


  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  public static readonly requiresProject = true;

  protected packageDirectories: PackageDir[] = [];
  protected projectConfig: any;
  protected instanceUrl: string|undefined = '';
  protected accessToken: string = '';
  protected allClasses: string[] = [];

  public async run(): Promise<void> {
    const {flags} = await this.parse(Query);
    this.accessToken = flags['target-org']?.getConnection().accessToken?.toString();
    this.instanceUrl = flags['target-org']?.getConnection().instanceUrl;
    this.projectConfig = await  (await SfProject.resolve()).resolveProjectConfig();

    this.packageDirectories = this.projectConfig.packageDirectories;
    this.packageDirectories.forEach((directory: PackageDir) => {
      this.getAllClasses(directory.path);
    });
    await Promise.all(this.allClasses.map(async (file) => {
      const fileContent = fs.readFileSync(file, 'utf8');
      let match;
      const queries = [];
      while ((match = SOQL_REGEX.exec(fileContent)) !== null) {
        const query = match[0].substring(1, match[0].length - 1);
        queries.push(query);
      }
      if (queries.length === 1){
        await this.scanQuery(file, queries[0]);
      }else if (queries.length > 1){
        await Promise.all(queries.map(async (query) => {
          try{
            await this.scanQuery(file, query);
          }catch(err){
            ux.error(`${file}-${query}-${(err as Error).message}`);
          }
        }));
      }
    }));
  }
  public async scanQuery(file: string, query: string): Promise<void>{
    const url = `${this.instanceUrl}/services/data/v57.0/query/?explain=${encodeURIComponent(query)}`;
    const headers: Headers = new Headers();
    headers.append('Authorization',  'Bearer ' + this.accessToken);
    headers.append('X-SFDC-Session',  'Bearer ' + this.accessToken);
    headers.append('Content-Type', 'application/json; charset=UTF-8');
    headers.append('Accept', 'application/json');
    const options: RequestInit = {
      method: 'GET',
      headers,
    };
    try{
      const response: Response = await fetch(url, options);
      const body: any = await response.json();
      if (!body.plans || body.plans.length === 0){
        this.log(body);
        return;
      }
      this.log(messages.getMessage('class', [file]));
      this.log(messages.getMessage('query', [query]));
      for (const queryPlan of body) {
        this.log(queryPlan);
        for (const queryPlanNote of queryPlan.notes) {
          this.log(queryPlanNote);
        }
      }
      this.log('----------------------------------------------------');
    } catch(err){
      this.error(err as Error);
    }
  }

  public getAllClasses(directory: string): void {
    const currentDirectorypath = path.join(directory);

    const currentDirectory = readdirSync(currentDirectorypath, 'utf8');

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