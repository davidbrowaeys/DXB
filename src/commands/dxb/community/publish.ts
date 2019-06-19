
import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError } from '@salesforce/core';

const exec = require('child_process').execSync;
const request = require('request');

export default class CommunityPublish extends SfdxCommand {

    public static description = 'Publish community(network) using connect api.';
  
    public static examples = [
    `$ sfdx dxb:community:publish -n "Customer_Community" -u myorg`,
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        communityname: flags.string({char:'n',description:'Name of community', required:true})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;
  
    public async run() {
        let communityname = this.flags.communityname;
        let orgname = this.org.getUsername();
        try{
            let accessToken = this.org.getConnection().accessToken;
            let instanceUrl = this.org.getConnection().instanceUrl;

            if (!accessToken || !instanceUrl){
                throw new SfdxError(`Connection not valid.`);
            }
            //get id of the community network
            var community =  JSON.parse(exec(`sfdx force:data:soql:query -q "SELECT Id FROM Network WHERE Name = '${communityname}'" --json -u ${orgname}`).toString());
            //call connect api publisher
            var results = await this.publishRequest(accessToken,instanceUrl,community.result.records[0].Id);
            this.ux.log(results.message);
        }catch(err){
            this.ux.error(err);
        }
    }

    async publishRequest(accessToken, instanceUrl, communityId){
        try{
            return new Promise(async function (resolve, reject) {
                const options = {
                    method  : 'POST',
                    headers : {
                                'Authorization' : 'Bearer ' + accessToken,
                                'X-SFDC-Session' : accessToken
                                },
                    url     : `${instanceUrl}/services/data/v46.0/connect/communities/${communityId}/publish`,
                    json: true,
                };
                await request(options, function (error, response, body) {
                    if (error || (response.statusCode < 200 && response.statusCode >= 300)){
                        throw new SfdxError(error ? error : response.statusMessage);
                    }
                    resolve(body);
                });
            });
        }catch(err){
            throw new SfdxError(`Unable to access ${instanceUrl}`);
        }
    }
}
