/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { QueryExplainResult } from 'jsforce';
import * as TableModule from 'cli-table3';
const Table = TableModule.default;

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'data.query.explain');

export type DataQueryExplainResult = {
  result: string | QueryExplainResult;
};

export default class DataQueryExplain extends SfCommand<DataQueryExplainResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    query: Flags.string({
      char: 'q',
      summary: messages.getMessage('flags.query.summary'),
    }),
  };

  protected isJsonOnly: boolean | undefined;

  public async run(): Promise<DataQueryExplainResult> {
    const { flags } = await this.parse(DataQueryExplain);
    const query = flags.query;
    this.isJsonOnly = flags.json;

    if (!query) {
      throw messages.createError('error.missingQueryFlag');
    }

    if (!this.isJsonOnly) {
      this.log(messages.getMessage('log.connecting'));
    }
    const accessToken = flags['target-org']?.getConnection().accessToken;
    const instanceUrl = flags['target-org']?.getConnection().instanceUrl;

    if (!accessToken || !instanceUrl) {
      throw messages.createError('error.queryNotValid');
    }

    const result = await this.queryPlan(query, accessToken, instanceUrl);
    return { result };
  }

  public displayAsTable(body: QueryExplainResult): void{
    const table = new Table({
      head: ['Cardinality', 'Fields', 'Leading \nOperation Type', 'Relative Cost', 'Object Cardinality', 'Object Type'],
      colWidths: [20, 50, 20, 20, 20, 20],
    });
    const noteTable = new Table({
      head: ['Description', 'Fields', 'TableEnumOrId'],
      colWidths: [70, 30, 30],
    });

    for (const plan of body.plans) {
      table.push([
        plan.cardinality,
        plan.fields.toString(),
        plan.leadingOperationType,
        plan.relativeCost,
        plan.sobjectCardinality,
        plan.sobjectType,
      ]);

      for (const note of plan.notes) {
        noteTable.push([note.description, note.fields.toString(), note.tableEnumOrId]);
      }
    }
    this.log(`${table.toString()}\n=== Notes\n${noteTable.toString()}`);
  }

  public async queryPlan(query: string, accessToken: string, instanceUrl: string): Promise<QueryExplainResult> {
    const url = `${instanceUrl}/services/data/v57.0/query/?explain=${encodeURIComponent(query)}`;
    const headers = new Headers();
    headers.append('Authorization', 'Bearer ' + accessToken);
    headers.append('X-SFDC-Session', 'Bearer ' + accessToken);
    headers.append('Content-Type', 'application/json; charset=UTF-8');
    headers.append('Accept', 'application/json');
    const options: RequestInit = {
      method: 'GET',
      headers,
    };
    try {
      const response = await fetch(url, options);
      const body: QueryExplainResult = (await response.json()) as QueryExplainResult;
      if (!body.plans || body.plans.length === 0) {
        this.log(messages.getMessage('log.noExplanation'));
        this.log(JSON.stringify(body));
      }else{
        this.displayAsTable(body);
      }
      return body;
    } catch (error) {
      const e = error as Error;
      throw messages.createError('error.unexpected', undefined, undefined, e, e);
    }
  }
}
