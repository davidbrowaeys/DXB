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
  	`$ sfdx dxb:org:limits -u myOrg@example.com`
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
			let accessToken = this.org.getConnection().accessToken;
			let instanceUrl = this.org.getConnection().instanceUrl;
      console.log('Connecting to ',instanceUrl,'...\n',accessToken);
			var output = JSON.parse(exec(`curl \"${instanceUrl}/services/data/v45.0/limits/\" -H \"Authorization: Bearer ${accessToken}\"`).toString());
      
      var Table = require('tty-table');
      var chalk = require('chalk');
      var header = [
        {
          value : "Item",
          color : "white", 
          align : "left",
          paddingLeft : 5,
          width : 50
        },
        {
          value : "Remaining",
          color : "white", 
          width : 20,
          paddingLeft : 5,
          align : "left"
        },
        {
          value : "Max",
          color : "white", 
          width : 20,
          paddingLeft : 5,
          align : "left"
        },
        {
          value : "Percentage",
          color : "white", 
          width : 30,
          paddingLeft: 5,
          align: "left",
          formatter : function(value){
            var str = value.toFixed(2) + '%';
            if(value < 10){
              str = chalk.black.red(str);
            }else if(value < 30){
              str = chalk.black.yellow(str);
            }
            return str;
          }
        }
      ];


      var rows = [];
      for (var i in output){
        rows.push([
            i,
            output[i].Remaining || 'N/A',
            output[i].Max || 'N/A',
            (output[i].Remaining / output[i].Max * 100)
        ]);
      }
      var t1 = Table(header,rows,null,{
        borderStyle : 1,
        borderColor : "blue",
        paddingBottom : 0,
        headerAlign : "center",
        align : "center",
        color : "white",
        truncate: "..."
      });
      console.log(t1.render());
  }
}
