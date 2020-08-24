import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError } from '@salesforce/core';
import * as fs from 'fs-extra';
import * as path from 'path';

export default class DXBScanner extends SfdxCommand {

  public static description = 'This command extend scanner-code plugin and throw error if severity 1 rule are met.';

  public static examples = [
    `$ sfdx dxb:source:scanner -f apex_pmd_results.json`
  ];

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    file: flags.string({ char: 'f', description: 'file path of code scanner results'}),
    excludedfiles: flags.string({ char: 'e', description: 'file path of classes to exclude'}), 
    severity: flags.number({ char: 's', description: 'severity threshold, if set to 3 it will throw an error for all violations where severity is 3 and lower', default: 1}), 
    highseverityrules: flags.string({ char: 'r', description: 'Name of the rules you want to mark a high severity'}),
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  private getExcludedFiles(excludedFilesPath){
  	var excludedFiles = [];
  	try{
		excludedFiles = JSON.parse(fs.readFileSync(excludedFilesPath).toString());
  	}catch(err){
  		console.log('No excluded files found\n');
  	}
  	return excludedFiles;
  }

  public async run() {
    let filepath = this.flags.file;
    let excludedFilesPath = this.flags.excludedfiles;
    let highseverityrules = this.flags.highseverityrules;
    if (highseverityrules){
    	highseverityrules = highseverityrules.split(',');
    }
    let severity = this.flags.severity;
    if (!fs.existsSync(filepath)) {
    	throw new SfdxError("PMD JSON Report file results does not exist!");
    }
    this.ux.log('Calculating quality gate...\n');
    let results = JSON.parse(fs.readFileSync(filepath).toString());
    let excludedFiles = this.getExcludedFiles(excludedFilesPath);
    let throwError = false;
    results.forEach(elem => {
    	let content = '';
    	let fileJson: any = path.parse(elem.fileName);
    	if (elem.violations && !excludedFiles.includes(fileJson.name)){
    		elem.violations.forEach( v => {
    			if (parseInt(v.severity) <= severity || highseverityrules.includes(v.ruleName)) {
    				content += `${fileJson.name}[${v.line} - ${v.column}] - ${v.ruleName}(${v.category}) - Severity(${v.severity}) ${v.message}\n`;
    				throwError = true;
    			}
    		});
    	}	
    	if (content !== '') {
    		this.ux.log(content);
    	}
    });
    if (throwError){
    	throw new SfdxError("We have detected some very bad violations in your code. Run sfdx scanner locally.");	
    }

  }
}