import { execSync as exec } from 'child_process';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import * as Table from 'cli-table3';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'object.relationships.list');

export type ObjectRelationshipsListResult = {
  table: string;
};

export default class ObjectRelationshipsList extends SfCommand<ObjectRelationshipsListResult> {
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

  public async run(): Promise<ObjectRelationshipsListResult> {
    const { flags } = await this.parse(ObjectRelationshipsList);
    const orgname = flags['target-org']?.getUsername();
    const sobject = flags.objectname;
    const filter = flags.filter;

    try {
      const objectschema = this.retrievesobjectchildrelationship(orgname, sobject);
      let relationShips: Array<{ relationshipName: string; childSObject: string }> =
        JSON.parse(objectschema).result.childRelationships;

      const tmp = [];
      for (const relationShip of relationShips) {
        if (
          relationShip.relationshipName &&
          (!filter || (filter && relationShip.relationshipName.toLowerCase().includes(filter.toLowerCase())))
        ) {
          tmp.push(relationShip);
        }
      }
      relationShips = tmp;

      const table = new Table();
      for (let i = 0; i < relationShips.length; i = i + 4) {
        table.push([
          relationShips[i] ? relationShips[i].relationshipName + '(' + relationShips[i].childSObject + ')' : '',
          relationShips[i + 1]
            ? relationShips[i + 1].relationshipName + '(' + relationShips[i + 1].childSObject + ')'
            : '',
          relationShips[i + 2]
            ? relationShips[i + 2].relationshipName + '(' + relationShips[i + 2].childSObject + ')'
            : '',
          relationShips[i + 3]
            ? relationShips[i + 3].relationshipName + '(' + relationShips[i + 3].childSObject + ')'
            : '',
        ]);
      }
      return { table: table.toString() };
    } catch (err: any) {
      this.error(err);
    }
  }

  private retrievesobjectchildrelationship(orgname: string | undefined, sobject: string): string {
    this.log(messages.getMessage('log.retrieveSchema', [sobject]));
    orgname = orgname ? '-u ' + orgname : '';
    return exec(`sfdx force:schema:sobject:describe -s ${sobject} ${orgname} --json`).toString();
  }
}
