import { flags, SfdxCommand } from '@salesforce/command';
import * as fs from 'fs';

export default class extends SfdxCommand {

  public static description = 'This command generate delta package by doing git diff.';

  public static examples = [
    `$ sfdx dxb:org:data --config config/cty-env-mapping.json --environment ST`
  ];

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    config: flags.string({ char: 'f', description: 'Path to config file', required:true}),
    environment: flags.string({ char: 'f', description: 'Path to config file', required:true})
  };

  protected testClasses: string[] = [];
  protected allClasses: string[] = [];
  protected processedClasses: string[] = [];
  protected regex;
  protected projectConfig;

  public async run() {
    //flags
    let config = this.flags.config;
    let environment = this.flags.environment;

    let envMapping = JSON.parse(fs.readFileSync(config).toString());
    envMapping[environment].forEach(file => {
      console.log('Processing:',file.pagePath);
      var fileContent = fs.readFileSync(file.pagePath).toString();
      file.replacerules.forEach(rule => {
        fileContent = fileContent.replace(new RegExp(rule.source,'g'), rule.target);
      });
      fs.writeFileSync(file.pagePath, fileContent);
    });
  }
}