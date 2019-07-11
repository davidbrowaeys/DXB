
import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError} from '@salesforce/core';

const request = require('request-promise');
const fs = require('fs');
var xml2js = require('xml2js');
var parser = new xml2js.Parser( {"explicitArray":false,"ignoreAttrs":true, "xmlns":true,"trim":true});

var timestamp;
var jobId;
var query;
var objectname;
var connection;
var interval;
var frequency;
var outputdir;
var filename;
var ux;

export default class BulkExport extends SfdxCommand {

    public static description = 'Export salesforce data using bulk api';
  
    public static examples = [
    `$ deloitte force:data:bulk:query -q "select id from Account" -u dev2`,
    `$ deloitte force:data:bulk:query -q "select id from Account" -u dev2 -d ./dataoutputdir -i 10000`,
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        query: flags.string({char:'q', description: 'soql query', required:true}),
        outputdir: flags.string({char:'d', description: 'bulk data output directory', default : 'bulk_output'}),
        filename: flags.string({char:'f', description: 'name of the csv file generated. if not specified, it will default to "<objeectname>_<timestamp>.csv"'}),
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
        outputdir = this.flags.outputdir;
        objectname = query.replace(/\([\s\S]+\)/g, '').match(/FROM\s+(\w+)/i)[1];
        
        if (!objectname) {
          throw new SfdxError("No sobject type found in query, maybe caused by invalid SOQL.", "Invalid SOQL");
        }
        timestamp = Date.now();
        filename = this.flags.filename ? this.flags.filename : `${objectname}_${timestamp}`;
        ux = this.ux;
        connection = this.org.getConnection();
        if (!connection || !connection.accessToken || !connection.instanceUrl){
            throw new SfdxError(`No configuration found for this org.`, "Invalid Connection");
        }
        execute();
    }
}
/**
 * @description create bulk job
 */
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
      .then(addBatch);
}
/**
 * @description Add query to batch job
 */
function addBatch(response){
  jobId = response.id;
  
  ux.log('======','Status');
  ux.log('Job ID:  ',jobId);
  ux.log('Status:  ','Open');
  ux.log('Query:  ',query,'\n');

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
/**
 * @description Check for job status
 */
function checkJobStatus(response){
  const options = {
      method  : 'GET',
      uri : `${connection.instanceUrl}/services/async/46.0/job/${jobId}`,
      headers: {
        'Authorization' : 'Bearer ' + connection.accessToken,
        'X-SFDC-Session': connection.accessToken,
        'Content-type' : 'application/json; charset=UTF-8'
      }
  };
  ux.startSpinner('Processing...');
  interval = setInterval(function(options) {
    request(options)
      .then(response => {
        response = JSON.parse(response);
        if (response.numberBatchesTotal === ( response.numberBatchesFailed + response.numberBatchesCompleted)){
          //getJobBatches(response);
          closeJob(response);
        }
      })
      .catch(console.log);
  }, frequency, options); 
}

function closeJob(job_status){

  clearInterval(interval);
  ux.stopSpinner();
  ux.log('\n\n======','Job Results');
  ux.log('Number Batches Failed:',job_status.numberBatchesFailed);
  ux.log('Number Batches Completed:',job_status.numberBatchesCompleted);
  ux.log('Number Batches Total:',job_status.numberBatchesTotal,'\n');

  var options = {
      method: 'POST',
      uri : `${connection.instanceUrl}/services/async/46.0/job/${jobId}`,
      headers: {
        'Authorization' : 'Bearer ' + connection.accessToken,
        'X-SFDC-Session': connection.accessToken,
        'Content-Type': 'text/csv; charset=UTF-8'
      },
      body: '<?xml version="1.0" encoding="UTF-8"?>'+
      '<jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload">'+
      '  <state>Closed</state>'+
      '</jobInfo>'
  };
  request(options).then( response => {
    getJobBatches();
  }).catch(console.log);
}
function getJobBatches(){
  const options = {
      method  : 'GET',
      uri : `${connection.instanceUrl}/services/async/46.0/job/${jobId}/batch`,
      headers: {
        'Authorization' : 'Bearer ' + connection.accessToken,
        'X-SFDC-Session': connection.accessToken,
        'Content-type' : 'application/json; charset=UTF-8'
      }
  };
  ux.startSpinner('Extracting...');
  request(options)
    .then( response => {
      parser.parseString(response,function (err, result) {
        ux.log('\n\n======','Batch Results');
        result.batchInfoList.batchInfo.forEach(elem => {
          ux.log('Batch ID:',elem.id._,' - Status:',elem.state._);
          if (elem.state._ === 'Completed'){
            getResult(elem.id._);
          }
        });
      });
    }).catch(console.log);
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
    if (!fs.existsSync(outputdir)){
      fs.mkdirSync(outputdir);
    }
    if (!fs.existsSync(`${outputdir}/${filename}.csv`)){
      fs.writeFileSync(`${outputdir}/${filename}.csv`,response);
    }else{
      response = response.substring(response.indexOf('\n')+1); //removing header, +1 to remove the first line-break
      fs.appendFileSync(`${outputdir}/${filename}.csv`,response);
    }
  })
  .catch(console.log);
}
