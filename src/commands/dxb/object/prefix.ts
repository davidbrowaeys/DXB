import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Connection, DescribeSObjectResult } from 'jsforce';
import { DescribeGlobalSObjectResult } from 'jsforce/lib/api/soap/schema';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'object.prefix');

export type ObjectPrefixResult = {
  objectName?: string;
  keyPrefix?: string;
};

export default class ObjectPrefix extends SfCommand<ObjectPrefixResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'object-name': Flags.string({
      char: 's',
      summary: messages.getMessage('flags.object-name.summary'),
      exclusive: ['prefix'],
      aliases: ['objectname'],
      deprecateAliases: true,
    }),
    prefix: Flags.string({
      char: 'p',
      summary: messages.getMessage('flags.prefix.summary'),
      exclusive: ['object-name'],
    }),
  };

  protected connection: Connection | undefined;

  public async run(): Promise<ObjectPrefixResult> {
    const { flags } = await this.parse(ObjectPrefix);
    this.connection = flags['target-org']?.getConnection();
    const sobject = flags['object-name'];
    const prefix = flags.prefix;
    if (!sobject && !prefix) {
      throw messages.createError('error.invalidArguments');
    }
    if (sobject) {
      const orgname = flags['target-org']?.getUsername();
      const objectDescribeResult = await this.retrievesobjectfields(orgname!, sobject);
      const keyPrefix = objectDescribeResult?.keyPrefix ?? undefined;
      if (!this.jsonEnabled()) {
        this.log(messages.getMessage('log.result.prefix', [keyPrefix]));
      }
      return { objectName: sobject, keyPrefix };
    } else if (prefix) {
      const accessToken = flags['target-org']?.getConnection()?.accessToken;
      const instanceUrl = flags['target-org']?.getConnection()?.instanceUrl;

      if (!accessToken || !instanceUrl) {
        throw messages.createError('error.invalidConnection');
      }

      let objectName;
      const globalschema: DescribeGlobalSObjectResult[] = (await this.retrieveGlobalSchema()) ?? [];
      for (const o of globalschema) {
        if (o.keyPrefix === prefix) {
          objectName = o.name;
          break;
        }
      }
      if (objectName) {
        if (!this.jsonEnabled()) {
          this.log(messages.getMessage('log.result.objectname', [objectName]));
        }
        return { objectName, keyPrefix: prefix };
      } else {
        throw messages.createError('error.prefixNotFound');
      }
    } else {
      throw messages.createError('error.unexpected');
    }
  }

  private async retrievesobjectfields(orgname: string, sobject: string): Promise<DescribeSObjectResult | undefined> {
    if (!this.jsonEnabled()) {
      this.log(messages.getMessage('log.getFields', [sobject, orgname]));
    }
    return this.connection?.describeSObject(sobject);
  }

  private async retrieveGlobalSchema(): Promise<DescribeGlobalSObjectResult[] | undefined> {
    if (!this.jsonEnabled()) {
      this.log(messages.getMessage('log.globalSchema'));
    }
    return (await this.connection?.describeGlobal())?.sobjects;
  }
}
