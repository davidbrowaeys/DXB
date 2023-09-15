import { SfdxCommand } from '@salesforce/command';
import { SfdxProject } from '@salesforce/core';
import * as path from 'path';
import * as fs from 'fs';

interface PackageDirectory {
  path: string;
  default: boolean;
}

const SOQL_REGEX = /\[SELECT\s.*?\]|\(\'(SELECT|select).*\'\)/g;

export default class extends SfdxCommand {

  public static description = 'This command generate delta package by doing git diff.';

  public static examples = [
    `$ sfdx dxb:apex:scan:query -m tags -k mytag`,
  ];

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {};

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;
  protected packageDirectories: PackageDirectory[] = [];
  protected projectConfig;
  protected instanceUrl:string;
  protected accessToken:string;
  protected allClasses: string[] = [];
  public async run() {
    this.accessToken = this.org.getConnection().accessToken;
    this.instanceUrl = this.org.getConnection().instanceUrl;
    this.projectConfig = await  (await SfdxProject.resolve()).resolveProjectConfig();
    
    this.packageDirectories = this.projectConfig.packageDirectories;
    this.packageDirectories.forEach((directory: PackageDirectory) => {
        this.getAllClasses(directory.path);
    });
    await Promise.all(this.allClasses.map(async (file) => {
        const fileContent = fs.readFileSync(file, 'utf8');
        let match;
        let queries = [];
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
                    console.error(file, query, err);    
                }
            }));
        }
    }));
  }
  public async scanQuery(file, query){
    const url = `${this.instanceUrl}/services/data/v57.0/query/?explain=${encodeURIComponent(query)}`;
    const headers = new Headers();
    headers.append('Authorization',  'Bearer ' + this.accessToken);
    headers.append('X-SFDC-Session',  'Bearer ' + this.accessToken);
    headers.append('Content-Type', 'application/json; charset=UTF-8');
    headers.append('Accept', 'application/json');
    const options: RequestInit = {
        method: 'GET',
        headers: headers,
    };
    try{
        const response = await fetch(url, options);
        const body:any = await response.json();
        if (!body.plans || body.plans.length === 0){
            console.log(body);
            return;
        }
        console.log('Class:',file);
        console.log('Query:',query);
        for (var i = 0 ; i < body.plans.length; i++){
            console.log(body.plans[i]);

            for (var n = 0; n < body.plans[i].notes.length; n++){
                console.log(body.plans[i].notes[n]); 
            }
        }
        console.log('----------------------------------------------------');
    }catch(err){
        console.error(err);
    }
  }
  public getAllClasses(directory: string) {
    var currentDirectorypath = path.join(directory);

    var currentDirectory = fs.readdirSync(currentDirectorypath, 'utf8');

    currentDirectory.forEach((file: string) => {
        var pathOfCurrentItem: string = path.join(directory + '/' + file);
        if (fs.statSync(pathOfCurrentItem).isFile() && file.endsWith('.cls')) {
            this.allClasses.push(pathOfCurrentItem);
        } else if (!fs.statSync(pathOfCurrentItem).isFile()) {
            var directorypath = path.join(directory + '/' + file);
            this.getAllClasses(directorypath);
        }
    });
}
}