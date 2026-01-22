import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { QueryResult, Connection } from 'jsforce';
import * as TableModule from 'cli-table3';
const Table = TableModule.default;
import colors from '@colors/colors';

// Define interfaces for SOQL query results (different from Metadata API types)
interface ObjectPermResult {
  SobjectType: string;
  Parent: { Name: string };
  PermissionsViewAllRecords: boolean;
  PermissionsRead: boolean;
  PermissionsModifyAllRecords: boolean;
  PermissionsEdit: boolean;
  PermissionsDelete: boolean;
  PermissionsCreate: boolean;
}

interface FieldPermResult {
  Id: string;
  Field: string;
  Parent: { Name: string };
  PermissionsEdit: boolean;
  PermissionsRead: boolean;
  SobjectType: string;
}

interface PermissionSetQueryResult {
  Id: string;
  ProfileId: string;
  Profile: { Name: string };
  Name: string;
  ObjectPerms?: { records: ObjectPermResult[] };
  FieldPerms?: { records: FieldPermResult[] };
}

export interface ObjectPermissionInfo {
  permissionSetName: string;
  create: boolean;
  read: boolean;
  edit: boolean;
  delete: boolean;
  viewAll: boolean;
  modifyAll: boolean;
}

export interface FieldPermissionInfo {
  permissionSetName: string;
  read: boolean;
  edit: boolean;
}

export type UserFindAccessResult = {
  success: boolean;
  username: string;
  objectName: string;
  fieldName?: string;
  objectPermissions?: ObjectPermissionInfo[];
  fieldPermissions?: FieldPermissionInfo[];
};
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'user.access.why');
export default class UserFindAccess extends SfCommand<UserFindAccessResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    username: Flags.string({
      char: 'i',
      required: false,
      summary: messages.getMessage('flags.username.summary'),
    }),
    'object-name': Flags.string({
      char: 's',
      required: true,
      summary: messages.getMessage('flags.object-name.summary'),
      aliases: ['objectname'],
      deprecateAliases: true,
    }),
    'field-name': Flags.string({
      char: 'f',
      required: false,
      summary: messages.getMessage('flags.field-name.summary'),
      default: '',
      aliases: ['fieldname'],
      deprecateAliases: true,
    }),
  };

  public async run(): Promise<UserFindAccessResult> {
    const { flags } = await this.parse(UserFindAccess);
    this.spinner.start('Scanning org for user access');
    // Uses latest API version
    let username: string | undefined = flags.username;
    const objectname: string = flags['object-name'];
    const fieldname: string = flags['field-name'];
    if (!flags['target-org']) {
      throw messages.createError('error.connection');
    }
    if (!username) {
      username = flags['target-org'].getUsername()!;
    }
    const connection: Connection = flags['target-org']!.getConnection()!;
    let fieldpermSql = '';
    if (fieldname) {
      fieldpermSql = `,(SELECT ID, Field, Parent.Name, PermissionsEdit, PermissionsRead, SobjectType FROM FieldPerms WHERE SobjectType = '${objectname}' AND Field = '${objectname}.${fieldname}')`;
    } else {
      fieldpermSql = `,(SELECT SobjectType, Parent.Name, PermissionsViewAllRecords, PermissionsRead, PermissionsModifyAllRecords, PermissionsEdit, PermissionsDelete, PermissionsCreate FROM ObjectPerms WHERE SobjectType = '${objectname}')`;
    }
    const soql = `
        SELECT Id, ProfileId, Profile.Name, Name ${fieldpermSql}
        FROM PermissionSet
        WHERE Id IN (SELECT PermissionSetId FROM PermissionSetAssignment WHERE Assignee.Username = '${username}')`;
    console.log(soql);
    const result: QueryResult<PermissionSetQueryResult> = await connection.query(soql);

    const headers: string[] = [
      'Permission Set Name',
      'C(reate)',
      'R(ead)',
      'E(dit)',
      'D(elete)',
      'V(iew all)',
      'M(odify all)',
    ];

    const t1 = new Table({
      head: headers,
      style: {
        head: ['green'],
        border: ['blue'],
      },
      colWidths: [40, 20, 20, 20, 20, 20, 30],
      colAligns: ['left', 'center', 'center', 'center', 'center', 'center', 'center'],
      truncate: '...',
    });
    // Collect permission data for JSON output
    const objectPermissions: ObjectPermissionInfo[] = [];
    const fieldPermissions: FieldPermissionInfo[] = [];

    result.records.forEach((elem: PermissionSetQueryResult) => {
      // ObjectPerms is the SOQL relationship name for object permissions subquery
      if (elem.ObjectPerms?.records && elem.ObjectPerms.records.length >= 1) {
        const objPerm = elem.ObjectPerms.records[0];
        const permName = elem.ProfileId ? elem.Profile.Name: elem.Name;
        t1.push([
          permName,
          objPerm.PermissionsCreate ? colors.black.bgGreen('V') : colors.white.bgRed('X'),
          objPerm.PermissionsRead ? colors.black.bgGreen('V') : colors.white.bgRed('X'),
          objPerm.PermissionsEdit ? colors.black.bgGreen('V') : colors.white.bgRed('X'),
          objPerm.PermissionsDelete ? colors.black.bgGreen('V') : colors.white.bgRed('X'),
          objPerm.PermissionsViewAllRecords ? colors.black.bgGreen('V') : colors.white.bgRed('X'),
          objPerm.PermissionsModifyAllRecords ? colors.black.bgGreen('V') : colors.white.bgRed('X'),
        ]);
        // Add to JSON result
        objectPermissions.push({
          permissionSetName: permName,
          create: objPerm.PermissionsCreate,
          read: objPerm.PermissionsRead,
          edit: objPerm.PermissionsEdit,
          delete: objPerm.PermissionsDelete,
          viewAll: objPerm.PermissionsViewAllRecords,
          modifyAll: objPerm.PermissionsModifyAllRecords,
        });
      }
      // FieldPerms is the SOQL relationship name for field permissions subquery
      if (elem.FieldPerms?.records && elem.FieldPerms.records.length >= 1) {
        const fieldPerm = elem.FieldPerms.records[0];
        const permName = elem.ProfileId ? elem.Profile.Name: elem.Name;
        t1.push([
          permName,
          '',
          fieldPerm.PermissionsRead ? colors.black.bgGreen('V') : colors.white.bgRed('X'),
          fieldPerm.PermissionsEdit ? colors.black.bgGreen('V') : colors.white.bgRed('X'),
          '',
          '',
          '',
        ]);
        // Add to JSON result
        fieldPermissions.push({
          permissionSetName: elem.Name,
          read: fieldPerm.PermissionsRead,
          edit: fieldPerm.PermissionsEdit,
        });
      }
    });
    this.spinner.stop(messages.getMessage('spinner.stop.done'));
    // Only display console output if not in JSON mode
    if (!this.jsonEnabled()) {
      this.log(messages.getMessage('log.why', [username, objectname, fieldname]));
      this.log(t1.toString());
    }

    // Build result object
    const resultData: UserFindAccessResult = {
      success: true,
      username,
      objectName: objectname,
    };

    if (fieldname) {
      resultData.fieldName = fieldname;
      resultData.fieldPermissions = fieldPermissions;
    } else {
      resultData.objectPermissions = objectPermissions;
    }

    return resultData;
  }
}
