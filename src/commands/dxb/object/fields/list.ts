import { execSync as exec } from 'child_process';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import * as TableModule from 'cli-table3';
const Table = TableModule.default;
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'object.fields.list');

export type ObjectFieldsListResult = {
  table: string;
};

export default class ObjectFieldsList extends SfCommand<ObjectFieldsListResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'object-name': Flags.string({
      char: 's',
      summary: messages.getMessage('flags.object-name.summary'),
      required: true,
      aliases: ['objectname'],
      deprecateAliases: true,
    }),
    filter: Flags.string({ char: 'f', summary: messages.getMessage('flags.filter.summary') }),
  };

  public async run(): Promise<ObjectFieldsListResult> {
    const { flags } = await this.parse(ObjectFieldsList);
    const orgname = flags['target-org']?.getUsername();
    const sobject = flags['object-name'];
    const filter = flags.filter;

    try {
      const objectschema = this.retrievesobjectfields(orgname, sobject);
      let fields: Array<{ name: string; type: string }> = JSON.parse(objectschema).result.fields;
      if (filter) {
        const tmp = [];
        for (const field of fields) {
          if (field.name.toLowerCase().includes(filter.toLowerCase())) {
            tmp.push(field);
          }
        }
        fields = tmp;
      }
      const table = new Table();
      for (let i = 0; i < fields.length; i = i + 4) {
        table.push([
          fields[i] ? fields[i].name + '(' + fields[i].type + ')' : '',
          fields[i + 1] ? fields[i + 1].name + '(' + fields[i + 1].type + ')' : '',
          fields[i + 2] ? fields[i + 2].name + '(' + fields[i + 2].type + ')' : '',
          fields[i + 3] ? fields[i + 3].name + '(' + fields[i + 3].type + ')' : '',
        ]);
      }
      return { table: table.toString() };
    } catch (err: any) {
      this.error(err);
    }
  }

  private retrievesobjectfields(orgname: string | undefined, sobject: string): string {
    this.log(messages.getMessage('log.retrieveSchema', [sobject]));
    orgname = orgname ? '-u ' + orgname : '';
    return exec(`sfdx force:schema:sobject:describe -s ${sobject} ${orgname} --json`).toString();
  }
}
