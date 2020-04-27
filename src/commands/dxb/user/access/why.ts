import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError } from '@salesforce/core';
import { QueryResult } from 'jsforce';

const Table = require('tty-table');
const chalk = require('chalk');

export default class UserFindAccess extends SfdxCommand {

  public static description = 'Find why a specified user have access to a field or object';

  public static examples = [
    `$ sfdx dforce:user:access:why -o Product2`,
    `$ sfdx dforce:user:access:why -o Product2 -f External_ID__c`,
    `$ sfdx dforce:user:access:why -o Product2 -f External_ID__c -i johndoe@abc.com.au`,
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    username :flags.string({
      char: 'i',
      required: false,
      description: 'username of salesforce user. If not specified, will use dx default user'
    }),
    objectname :flags.string({
        char: 'o',
        required: true,
        description: 'salesforce api name of object, i.e.: Account, Invoice__c'
      }),
    fieldname :flags.string({
        char: 'f',
        required: false,
        description: 'salesforce api name of object, i.e.: AccountId, Name',
        default:''
      })
  };
  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run() {
      this.ux.startSpinner('Scanning org for user access');
      // Uses latest API version
        let username:any = this.flags.username;
        let objectname:string = this.flags.objectname;
        let fieldname:string = this.flags.fieldname;
        if (!this.org){
          throw new SfdxError('Connectons not established!');
        }
        if (!username) username = this.org.getUsername();
        const connection:any = this.org.getConnection();
        var fieldpermSql = '';
        if (fieldname) {
            fieldpermSql = `,(SELECT ID, Field, Parent.Name, PermissionsEdit, PermissionsRead, SobjectType FROM FieldPerms WHERE SobjectType = '${objectname}' AND Field = '${objectname}.${fieldname}')`
        }else{
            fieldpermSql = `,(SELECT SobjectType, Parent.Name, PermissionsViewAllRecords, PermissionsRead, PermissionsModifyAllRecords, PermissionsEdit, PermissionsDelete, PermissionsCreate FROM ObjectPerms WHERE SobjectType = '${objectname}')`;
        }
        const soql:string = `
        SELECT Id, Name ${fieldpermSql}
        FROM PermissionSet
        WHERE Id IN (SELECT PermissionSetId FROM PermissionSetAssignment WHERE Assignee.Username = '${username}')`;

        const result: QueryResult<{}> = await connection.query(soql);

        var headers:any = [
          {
              value : "Permission Set Name",
              headerColor : "green",
              color: "white",
              align : "left",
              paddingLeft : 2,
              width : 40
          },
          {
            value : "C(reate)",
            headerColor : "green",
            color: "white",
            align : "center",
            width : 20,
            formatter : formaPermission
          },
          {
            value : "R(ead)",
            headerColor : "green",
            color: "white",
            align : "center",
            width : 20,
            formatter : formaPermission
          },
          {
            value : "E(dit)",
            headerColor : "green",
            color: "white",
            align : "center",
            width : 20,
            formatter : formaPermission
          },
          {
            value : "D(elete)",
            headerColor : "green",
            color: "white",
            align : "center",
            width : 20,
            formatter : formaPermission
        },
        {
          value : "V(iew All)",
          headerColor : "green",
          color: "white",
          align : "center",
          width : 20,
          formatter : formaPermission
          },
          {
            value : "M(odified All)",
            headerColor : "green",
            color: "white",
            align : "center",
            width : 30,
            formatter : formaPermission
            }
        ];
        var rows:any = [];
        result.records.forEach( (elem:any) => {
          if (elem.ObjectPerms && elem.ObjectPerms !== null && elem.ObjectPerms.totalSize >= 1){
            rows.push([
              elem.Name,
              elem.ObjectPerms.records[0].PermissionsCreate   ? 'V' : 'X',
              elem.ObjectPerms.records[0].PermissionsRead   ? 'V' : 'X',
              elem.ObjectPerms.records[0].PermissionsEdit   ? 'V' : 'X',
              elem.ObjectPerms.records[0].PermissionsDelete   ? 'V' : 'X',
              elem.ObjectPerms.records[0].PermissionsViewAllRecords   ? 'V' : 'X',
              elem.ObjectPerms.records[0].PermissionsModifyAllRecords   ? 'V' : 'X'
            ]);
          }
          if (elem.FieldPerms && elem.FieldPerms !== null && elem.FieldPerms.totalSize >= 1){
            rows.push([
              elem.Name,
              '',
              elem.FieldPerms.records[0].PermissionsRead   ? 'V' : 'X',
              elem.FieldPerms.records[0].PermissionsEdit   ? 'V' : 'X',
              '',
              '',
              ''
            ]);
          }
        });
        var t1 = Table(headers,rows,null,{
            borderStyle : 1,
            borderColor : "blue",
            paddingBottom : 0,
            headerAlign : "center",
            align : "center",
            color : "white",
            truncate: "..."
        });
        this.ux.log(`\nWhy ${username} have access to ${objectname} ${fieldname}?`);
        this.ux.log(t1.render());
    }
  }
  function formaPermission(value:string){
          
    //will convert an empty string to 0	
    //value = value * 1;
    
    if(value === 'V'){
        value = chalk.black.bgGreen(value);
    }
    else{
        value = chalk.white.bgRed(value);
    }
    return value;
}
