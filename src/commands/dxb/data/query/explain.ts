import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError } from '@salesforce/core';

const request = require('request');

function queryPlan(query, accessToken, instanceUrl){
  const options = {
    method  : 'GET',
    headers : {
                'Content-Type' : 'application/json; charset=UTF-8',
                'Accept' : 'application/json',
                'Authorization' : 'Bearer ' + accessToken,
                'X-SFDC-Session' : accessToken
              },
    url     : instanceUrl+'/services/data/v43.0/query/?explain='+query,
    json: true,
  };
  request(options,
    function (error, response, body) {
        if (!error && response.statusCode == 200) {
          var Table = require('cli-table');
          var table = new Table({
                head: ['Cardinality', 'Fields','Leading \nOperation Type', 'Relative Cost', 'Object Cardinality','Object Type'], 
                colWidths: [20, 50, 20, 20, 20, 20]
          });
          var noteTable = new Table({
                head: ['Description', 'Fields','TableEnumOrId'], 
                colWidths: [70, 30, 30]
          });
          for (var i = 0 ; i < body.plans.length; i++){
            table.push([
                body.plans[i].cardinality,
                body.plans[i].fields.toString(),
                body.plans[i].leadingOperationType,
                body.plans[i].relativeCost,
                body.plans[i].sobjectCardinality,
                body.plans[i].sobjectType
              ]);

            for (var n = 0; n < body.plans[i].notes.length; n++){
              noteTable.push([
                  body.plans[i].notes[n].description,
                  body.plans[i].notes[n].fields.toString(),
                  body.plans[i].notes[n].tableEnumOrId
              ]); 
            }
          }
          console.log(table.toString());
          console.log('=== Notes');
          console.log(noteTable.toString());
        }else{
          console.log('Unexpected Error!');
          console.log(response);
        }
    }
  );
}

export default class QueryExplain extends SfdxCommand {

    public static description = 'CLI version of the salesforce query plan tool to optimize and speed up queries.';
  
    public static examples = [
        `$ sfdx dxb:data:quer:explain -u myorg -q "select id from Account where BillingCountry = 'Australia' limit 10"`
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        query: flags.string({char:'q',description:'query'})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;
  
    public async run() {
        let query = this.flags.query;
        if (!query){
          throw new SfdxError('Must specify query in order to use this command.');
        }

			  console.log('Connecting to org...');
        let accessToken = this.org.getConnection().accessToken;
        let instanceUrl = this.org.getConnection().instanceUrl;
        
        if (!accessToken || !instanceUrl){
          throw new SfdxError(`Connection not valid.`);
        }

        console.log('Connected to ',instanceUrl,'...\n',accessToken);

        queryPlan(query, accessToken, instanceUrl);
    }
}
