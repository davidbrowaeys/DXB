import { SfdxCommand } from '@salesforce/command';
import { SfdxError } from '@salesforce/core';

const request = require('request');

export default class OrgLimits extends SfdxCommand {

  public static description = 'Retrieve and display org limits';

  public static examples = [
  	`$ deloitte force:org:limits -u myOrg@example.com`
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
      console.log('Connecting to org...');
			let accessToken = this.org.getConnection().accessToken;
      let instanceUrl = this.org.getConnection().instanceUrl;
      
      if (!accessToken || !instanceUrl){
        throw new SfdxError(`Connection not valid.`);
      }

      console.log('Connected to ',instanceUrl,'...\n',accessToken);

      const options = {
          method  : 'GET',
          headers : {
                      'Content-Type' : 'application/json; charset=UTF-8',
                      'Accept' : 'application/json',
                      'Authorization' : 'Bearer ' + accessToken,
                      'X-SFDC-Session' : accessToken
                    },
          url     : instanceUrl+'/services/data/v45.0/limits',
          json: true,
        };
        request(options,
          function (error, response, body) {
              if (!error && response.statusCode == 200) {
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
                for (var i in body){
                  rows.push([
                      i,
                      body[i].Remaining || 'N/A',
                      body[i].Max || 'N/A',
                      (body[i].Remaining / body[i].Max * 100)
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
              }else{
                console.log('Unexpected Error!');
                console.log(response);
              }
          }
        );
    }
}
