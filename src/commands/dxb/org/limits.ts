import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';

const exec = require('child_process').execSync;
const path = require('path');
const fs = require('fs');

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('nabx', 'org');

export default class MetadataReset extends SfdxCommand {

  public static description = 'retrieve and display org limits';

  public static examples = [
  	`$ sfdx nabx:org:limits --targetusername myOrg@example.com`
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {};
  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run() {
			let orgname = this.org.getUsername();
			let auth = JSON.parse(exec(`sfdx force:org:display -u ${orgname} --json`).toString());
			let accessToken = auth.result.accessToken;
			let instanceUrl = auth.result.instanceUrl;
			console.log('Connecting to ',instanceUrl,'...',accessToken);
			var output = JSON.parse(exec(`curl \"${instanceUrl}/services/data/v45.0/limits/\" -H \"Authorization: Bearer ${accessToken}\"`).toString());
			var limitPercentage = output.DataStorageMB.Remaining / output.DataStorageMB.Max * 100;
			var messageType = limitPercentage < 10 ? '\x1b[91m%s\x1b[0m' : ''; 
			console.log(messageType,`Data Storage Limits: ${output.DataStorageMB.Remaining}/${output.DataStorageMB.Max}   ---   ${limitPercentage}%`);
  }
}
