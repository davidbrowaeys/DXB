import {Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Connection, Messages } from '@salesforce/core';
import { QueryResult, Schema } from 'jsforce';
import * as Table from 'cli-table3';
import { PermissionSet } from 'jsforce/lib/api/metadata';
import * as colors from '@colors/colors';
type UserFindAccessResult = {
  success: boolean;
}
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'user.access');
export default class UserFindAccess extends SfCommand<UserFindAccessResult> {

  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    username :Flags.string({
      char: 'i',
      required: false,
      summary: messages.getMessage('flags.username.summary')
    }),
    'object-name' :Flags.string({
        char: 's',
        required: true,
        summary: messages.getMessage('flags.object-name.summary')
      }),
    'field-name' :Flags.string({
        char: 'f',
        required: false,
        summary: messages.getMessage('flags.field-name.summary'),
        default:''
      })
  };

  public async run(): Promise<UserFindAccessResult> {
      const {flags} = await this.parse(UserFindAccess);
      this.spinner.start('Scanning org for user access');
      // Uses latest API version
        let username: string | undefined = flags.username;
        const objectname: string = flags['object-name'];
        const fieldname: string = flags['field-name'];
        if (!flags['target-org']){
          throw messages.createError('error.connection');
        }
        if (!username) {
          username = flags['target-org']!.getUsername()!;
        }
        const connection: Connection<Schema> = flags['target-org']!.getConnection()!;
        let fieldpermSql = '';
        if (fieldname) {
            fieldpermSql = `,(SELECT ID, Field, Parent.Name, PermissionsEdit, PermissionsRead, SobjectType FROM FieldPerms WHERE SobjectType = '${objectname}' AND Field = '${objectname}.${fieldname}')`
        }else{
            fieldpermSql = `,(SELECT SobjectType, Parent.Name, PermissionsViewAllRecords, PermissionsRead, PermissionsModifyAllRecords, PermissionsEdit, PermissionsDelete, PermissionsCreate FROM ObjectPerms WHERE SobjectType = '${objectname}')`;
        }
        const soql: string = `
        SELECT Id, Name ${fieldpermSql}
        FROM PermissionSet
        WHERE Id IN (SELECT PermissionSetId FROM PermissionSetAssignment WHERE Assignee.Username = '${username}')`;

        const result: QueryResult<PermissionSet> = await connection.query(soql);

        const headers: string[] = [
          'Permission Set Name', 'C(reate)', 'R(ead)', 'E(dit)', 'D(elete)', 'V(iew all)', 'M(odify all)'
        ];
        const headerStyles = [colors.green.toString(), colors.green.toString(), colors.green.toString(), colors.green.toString(), colors.green.toString(), colors.green.toString(), colors.green.toString()];

        const t1 = new Table({
          head: headers,
          style: {
            head: headerStyles,
            border: [colors.blue.toString()]
          },
          colWidths: [40, 20, 20, 20 ,20, 20, 30],
          colAligns: ['left', 'center', 'center', 'center', 'center', 'center', 'center'],
          truncate: '...'
        });
        result.records.forEach( (elem: PermissionSet) => {
          if (elem.objectPermissions && elem.objectPermissions !== null && elem.objectPermissions.length >= 1){
            t1.push([
              elem.fullName,
              elem.objectPermissions[0].allowCreate   ? colors.black.bgGreen('V') : colors.white.bgRed('X'),
              elem.objectPermissions[0].allowRead   ? colors.black.bgGreen('V') : colors.white.bgRed('X'),
              elem.objectPermissions[0].allowEdit   ? colors.black.bgGreen('V') : colors.white.bgRed('X'),
              elem.objectPermissions[0].allowDelete   ? colors.black.bgGreen('V') : colors.white.bgRed('X'),
              elem.objectPermissions[0].viewAllRecords   ? colors.black.bgGreen('V') : colors.white.bgRed('X'),
              elem.objectPermissions[0].modifyAllRecords   ? colors.black.bgGreen('V') : colors.white.bgRed('X')
            ]);
          }
          if (elem.fieldPermissions && elem.fieldPermissions !== null && elem.fieldPermissions.length >= 1){
            t1.push([
              elem.fullName,
              '',
              elem.fieldPermissions[0].readable   ? colors.black.bgGreen('V') : colors.white.bgRed('X'),
              elem.fieldPermissions[0].editable   ? colors.black.bgGreen('V') : colors.white.bgRed('X'),
              '',
              '',
              ''
            ]);
          }
        });
        this.spinner.stop(messages.getMessage('spinner.stop.done'));
        this.log(messages.getMessage('log.why', [username, objectname, fieldname]));
        this.log(t1.toString());
        return { success: true };
    }
  }
