import {Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { QueryExplainResult } from 'jsforce';
import * as Table from 'cli-table3';

function displayAsTable(body: QueryExplainResult): string {
  const table = new Table({
    head: ['Cardinality', 'Fields','Leading \nOperation Type', 'Relative Cost', 'Object Cardinality','Object Type'],
    colWidths: [20, 50, 20, 20, 20, 20]
  });
  const noteTable = new Table({
    head: ['Description', 'Fields','TableEnumOrId'],
    colWidths: [70, 30, 30]
  });
  for (const plan of body.plans) {
    table.push([
      plan.cardinality,
      plan.fields.toString(),
      plan.leadingOperationType,
      plan.relativeCost,
      plan.sobjectCardinality,
      plan.sobjectType
    ]);

    for (const note of plan.notes) {
      noteTable.push([
        note.description,
        note.fields.toString(),
        note.tableEnumOrId
      ]);
    }
  }
  return `${table.toString()}\n=== Notes\n${noteTable.toString()}`;
}

type Result = {
  result: any;
}

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'data.query.explain');
export default class QueryExplain extends SfCommand<Result> {

  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    query: Flags.string({
      char:'q',
      summary:messages.getMessage('flags.query.summary')
    })
  };

  protected isJsonOnly: boolean | undefined;

  public async run(): Promise<Result> {
    const {flags} = await this.parse(QueryExplain);
    const query = flags.query;
    this.isJsonOnly = flags.json;

    if (!query){
      throw new SfError('Must specify query in order to use this command.');
    }

    if (!this.isJsonOnly) {
      this.log(messages.getMessage('log.connecting'));
    }
    const accessToken = flags['target-org']!.getConnection().accessToken;
    const instanceUrl = flags['target-org']!.getConnection().instanceUrl;

    if (!accessToken || !instanceUrl){
      throw messages.createError('error.queryNotValid');
    }

    if (!this.isJsonOnly){
      this.log(messages.getMessage('log.connected',[instanceUrl,accessToken]));
    }

    const result = await this.queryPlan(query, accessToken, instanceUrl);
    return { result };
  }

  public async queryPlan(query: string, accessToken: string, instanceUrl: string): Promise<any> {
    const url = `${instanceUrl}/services/data/v57.0/query/?explain=${encodeURIComponent(query)}`;
    const headers = new Headers();
    headers.append('Authorization',  'Bearer ' + accessToken);
    headers.append('X-SFDC-Session',  'Bearer ' + accessToken);
    headers.append('Content-Type', 'application/json; charset=UTF-8');
    headers.append('Accept', 'application/json');
    const options: RequestInit = {
      method: 'GET',
      headers,
    };
    try{
      const response = await fetch(url, options);
      const body: QueryExplainResult = await response.json() as QueryExplainResult;
      if (!body.plans || body.plans.length === 0){
        this.log(messages.getMessage('log.noExplanation'));
        return;
      }
      if (this.isJsonOnly){
        return body;
      }

      return displayAsTable(body);;
    }catch(error){
      const e = error as Error;
      throw messages.createError('error.unexpected', undefined, undefined, e, e);
    }
  }
}
