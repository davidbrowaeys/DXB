import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError, SfdxProject } from '@salesforce/core';

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
  
    protected isJsonOnly:boolean;
    protected projectConfig;

    public async run() {
        let query = this.flags.query;
        this.isJsonOnly = this.flags.json;

        //project config
        this.projectConfig = await  (await SfdxProject.resolve()).resolveProjectConfig();
        if (!query){
          throw new SfdxError('Must specify query in order to use this command.');
        }

			  if (!this.isJsonOnly)console.log('Connecting to org...');
        let accessToken = this.org.getConnection().accessToken;
        let instanceUrl = this.org.getConnection().instanceUrl;
        
        if (!accessToken || !instanceUrl){
          throw new SfdxError(`Connection not valid.`);
        }

        if (!this.isJsonOnly)console.log('Connected to ',instanceUrl,'...\n',accessToken);

        const result = await this.queryPlan(query, accessToken, instanceUrl);
        if (this.isJsonOnly)return result;
    }

    public async queryPlan(query, accessToken, instanceUrl){
        const queryJson = this.parseQuery(query);
        console.log(queryJson);
        const url = `${instanceUrl}/services/data/v57.0/query/?explain=${encodeURIComponent(query)}`;
        const headers = new Headers();
        headers.append('Authorization',  'Bearer ' + accessToken);
        headers.append('X-SFDC-Session',  'Bearer ' + accessToken);
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
        if (this.isJsonOnly){
          return body;
        }
        this.displayAsTable(body);
        return;
      }catch(error){
        console.error(error);
        return undefined;
      }
    }

    public parseQuery(query) {
      // Split query by keywords
      const selectIndex = query.indexOf('SELECT');
      const fromIndex = query.indexOf('FROM');
      const whereIndex = query.indexOf('WHERE');
    
      // Extract fields
      const fieldsString = query.substring(selectIndex + 7, fromIndex).trim();
      const fields = fieldsString.split(',').map(field => field.trim());
    
      // Extract object
      const objectString = query.substring(fromIndex + 4, whereIndex).trim();
      const object = objectString.trim();
    
      // Extract conditions
      const conditionsString = query.substring(whereIndex + 5).trim();
      const conditions = conditionsString.trim();

      // Split conditions by 'AND' or 'OR'
      const conditionList = conditions.split(/\s+(AND|OR|and|or)\s+/).map(condition => condition.trim());
    
      // Create structured JSON
      const structuredQuery = {
        fields,
        object,
        conditions: conditionList
      };
    
      return structuredQuery;
    }

    public displayAsTable(body){
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
    }
}
