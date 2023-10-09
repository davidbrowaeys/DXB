import {Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Connection, Messages } from '@salesforce/core';
import { DescribeSObjectResult } from 'jsforce';
import { DescribeGlobalSObjectResult } from 'jsforce/lib/api/soap/schema';

type SObjectPrefixResult = {
  result: string;
}

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'object.prefix');
export default class SObjectPrefix extends SfCommand<SObjectPrefixResult> {
  
  public static readonly summary = messages.getMessage('summary');
  
  public static readonly examples = messages.getMessages('examples');
  
  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'object-name': Flags.string({char:'s',summary: messages.getMessage('flags.object-name.summary'), exclusive: ['prefix']}),
    prefix: Flags.string({char:'p', summary: messages.getMessage('flags.prefix.summary'), exclusive: ['object-name']})
  };
  
  protected connection: Connection | undefined;
  
  public async run(): Promise<SObjectPrefixResult> {
    const {flags} = await this.parse(SObjectPrefix);
    this.connection = flags['target-org']!.getConnection()!;
    const sobject = flags.objectname;
    const prefix = flags.prefix;
    if (!sobject && !prefix){
      throw messages.createError('error.invalidArguments');
    }
    if (sobject){
      const orgname = flags['target-org']!.getUsername()!;
      const keyPrefix = (await this.retrievesobjectfields(orgname,sobject)).keyPrefix;
      return {result: messages.getMessage('log.result.prefix', [keyPrefix])};
    } else if (prefix){
      const accessToken = flags['target-org']?.getConnection()?.accessToken;
      const instanceUrl = flags['target-org']?.getConnection()?.instanceUrl;
      
      if (!accessToken || !instanceUrl){
        throw messages.createError('error.invalidConnection');
      }
      
      let objectName;
      const globalschema: DescribeGlobalSObjectResult[] = await this.retrieveGlobalSchema();
      for (const o of globalschema) {
        if (o.keyPrefix === prefix) {
          objectName = o.name;
          break;
        }
      }
      if (objectName){
        return { result: messages.getMessage('log.result.objectname',[objectName])};
      } else {
        throw messages.createError('error.prefixNotFound');
      }
    } else {
      throw messages.createError('error.unexpected');
    }
  }
  
  private async retrievesobjectfields(orgname: string, sobject: string): Promise<DescribeSObjectResult>{
    this.log(messages.getMessage('log.getFields', [sobject, orgname]));
    return this.connection!.describeSObject(sobject);
  }
  
  private async retrieveGlobalSchema(): Promise<DescribeGlobalSObjectResult[]>{
    this.log(messages.getMessage('log.globalSchema'));
    return (await this.connection!.describeGlobal()).sobjects;
  }
}
