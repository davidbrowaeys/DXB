
import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError} from '@salesforce/core';

const request = require('request-promise');
const fs = require('fs');
var xml2js = require('xml2js');
var parser = new xml2js.Parser( {"explicitArray":false,"ignoreAttrs":true, "xmlns":true,"trim":true});

var jobId;
var query;
var objectname;
var connection;
var interval;
var frequency;

export default class BulkExport extends SfdxCommand {

    public static description = 'Retrieve key prefix of specified sobject.';
  
    public static examples = [
    `$ sfdx dxb:data:bulk:query -q "select id from Account" -u dev2`,
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        query: flags.string({char:'q', description: 'soql query', required:true}),
        pollinginterval: flags.number({char: 'i', description: 'polling interval for job status check',default:6000})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;
  
    public run() {
        query = this.flags.query;
        frequency = this.flags.pollinginterval;
        objectname = query.replace(/\([\s\S]+\)/g, '').match(/FROM\s+(\w+)/i)[1];
        if (!objectname) {
          throw new SfdxError("No sobject type found in query, maybe caused by invalid SOQL.");
        }

        try{
          connection = this.org.getConnection();

          if (!connection || !connection.accessToken || !connection.instanceUrl){
              throw new SfdxError(`Connection not valid.`);
          }
          execute();
        }catch(err){
            this.ux.error(err);
        }   
    }
}
function execute(){
  const options = {
    method  : 'POST',
    uri     : connection.instanceUrl+'/services/async/46.0/job',
    headers : {
      'Authorization' : 'Bearer ' + connection.accessToken,
      'X-SFDC-Session' : connection.accessToken,
      'Content-type' : 'application/json; charset=UTF-8',
      'Sforce-Enable-PKChunking': 'true'
    },
    json: true,
    body: {
      "operation": "query",
      "object": objectname,
      "concurrencyMode": "Parallel",
      "contentType": "CSV"
    }
  };
  request(options)
      .then(addBatch)
      .catch(console.log);
}
function addBatch(response){
  jobId = response.id;
  const options = {
      method  : 'POST',
      uri : `${connection.instanceUrl}/services/async/46.0/job/${jobId}/batch`,
      headers : {
        'Authorization' : 'Bearer ' + connection.accessToken,
        'X-SFDC-Session': connection.accessToken,
        'Content-type' : 'text/csv; charset=UTF-8'
      },
      body: query
  };
  request(options)
      .then(checkJobStatus)
      .catch(console.log);
}
function checkJobStatus(response){
  console.log('======','Status');
  console.log('Job ID:  ',jobId);
  console.log('Status:  ','Open');

  const options = {
      method  : 'GET',
      uri : `${connection.instanceUrl}/services/async/46.0/job/${jobId}`,
      headers: {
        'Authorization' : 'Bearer ' + connection.accessToken,
        'X-SFDC-Session': connection.accessToken,
        'Content-type' : 'application/json; charset=UTF-8'
      }
  };
  console.log('\n\nProcessing...');
  interval = setInterval(function(options) {
    request(options)
      .then(response => {
        response = JSON.parse(response);
        if (response.numberBatchesTotal === ( response.numberBatchesFailed + response.numberBatchesCompleted)){
          getJobBatches(response);
        }
      })
      .catch(console.log);
  }, frequency, options); 
}
function getJobBatches(job_status){
  const options = {
      method  : 'GET',
      uri : `${connection.instanceUrl}/services/async/46.0/job/${jobId}/batch`,
      headers: {
        'Authorization' : 'Bearer ' + connection.accessToken,
        'X-SFDC-Session': connection.accessToken,
        'Content-type' : 'application/json; charset=UTF-8'
      }
  };
  clearInterval(interval);
  console.log('\n\n======','Result');
  console.log('Number Batches Failed:',job_status.numberBatchesFailed);
  console.log('Number Batches Completed:',job_status.numberBatchesCompleted);
  console.log('Number Batches Total:',job_status.numberBatchesTotal);
  request(options)
    .then( response => {
      parser.parseString(response,function (err, result) {
        console.log('\n\n======','Extracting batches');
        result.batchInfoList.batchInfo.forEach(elem => {
          console.log('Batch ID:',elem.id._,' - Status:',elem.state._);
          if (elem.state._ === 'Completed'){
            getResult(elem.id._);
          }
        });
      });
    })
    .catch(console.log);
}
function getResult(batchId){
  const options = {
      method  : 'GET',
      uri : `${connection.instanceUrl}/services/async/46.0/job/${jobId}/batch/${batchId}/result`,
      headers: {
        'Authorization' : 'Bearer ' + connection.accessToken,
        'X-SFDC-Session': connection.accessToken,
        'Content-type' : 'application/json; charset=UTF-8'
      }
  };
  request(options)
    .then(response => {
      parser.parseString(response,function (err, result) {
        var resultId = result["result-list"].result._;
        getResultData(batchId, resultId);
      });
    })
    .catch(console.log);
}
function getResultData(batchId, resultId){
  const options = {
      method  : 'GET',
      uri : `${connection.instanceUrl}/services/async/46.0/job/${jobId}/batch/${batchId}/result/${resultId}`,
      headers: {
        'Authorization' : 'Bearer ' + connection.accessToken,
        'X-SFDC-Session': connection.accessToken,
        'Content-type' : 'application/json; charset=UTF-8'
      }
  };
  request(options)
  .then(response => {
    if (!fs.existsSync(`${objectname}.csv`)){
      fs.writeFileSync(`${objectname}.csv`,response);
    }else{
      response = response.substring(response.indexOf('\n')+1); //+1 to remove the first line-break
      fs.appendFileSync(`${objectname}.csv`,response);
    }
  })
  .catch(console.log);
}
