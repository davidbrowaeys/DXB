import * as fs from 'fs-extra';
import {Flags, SfCommand } from '@salesforce/sf-plugins-core';
import * as xml2js from 'xml2js';
import * as js2xmlparser from 'js2xmlparser';
import { Messages } from '@salesforce/core';
type PermissionSetCreateResult = {
  path: string;
}
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'permissionset.create');
export default class PermissionSetCreate extends SfCommand<PermissionSetCreateResult> {

  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    profile: Flags.file({
      char: 'p',
      summary: messages.getMessage('flags.profile.summary'),
      required:true,
      exists: true
    }),
    'permissionset-name': Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.permissionset-name.summary'),
      required:true
    }),
    'output-dir': Flags.directory({
      char: 'r',
      summary: messages.getMessage('flags.output-dir.summary'),
      default: 'force-app/main/default/permissionsets'
    }),
    'has-activation-required': Flags.boolean({
      char: 'a',
      summary: messages.getMessage('flags.has-activation-required.summary'),
      default: false
    }),
    license: Flags.string({
      char: 'l',
      summary: messages.getMessage('flags.license.summary'),
      default: 'Salesforce'
    }),
    description: Flags.string({
      char: 'd',
      summary: messages.getMessage('flags.description.summary'),
    })
  };

  public async run(): Promise<PermissionSetCreateResult> {
    const {flags} = await this.parse(PermissionSetCreate);
    try{
      const permissionSetPath = `${flags['output-dir']}/${flags['permissionset-name']}.permissionset-meta.xml`;
      const data = await fs.readFile(flags.profile, {encoding: 'utf8'});
      const profileName = flags.profile.split('/');
      const result = (await xml2js.parseStringPromise(data, {
        explicitArray: false,
      }))?.Profile;
      const permissionSet: any = {
        label: flags['permissionset-name'],
        hasActivationRequired:flags['has-activation-required'],
        description: messages.getMessage('log.description',[profileName[profileName.length - 1]])
      };
      if (flags.license) permissionSet.license = flags.license;
      if (flags.description) permissionSet.description = flags.description;
      if (result.applicationVisibilities) permissionSet.applicationVisibilities = result.applicationVisibilities;
      if (result.classAccesses) permissionSet.classAccesses = result.classAccesses;
      if (result.customMetadataTypeAccesses) permissionSet.customMetadataTypeAccesses = result.customMetadataTypeAccesses;
      if (result.customPermissions) permissionSet.customPermissions = result.customPermissions;
      if (result.customSettingAccesses) permissionSet.customSettingAccesses = result.customSettingAccesses;
      if (result.externalDataSourceAccesses) permissionSet.externalDataSourceAccesses = result.externalDataSourceAccesses;
      if (result.flowAccesses) permissionSet.flowAccesses = result.flowAccesses;
      if (result.objectPermissions) permissionSet.objectPermissions = result.objectPermissions;
      if (result.fieldPermissions) permissionSet.fieldPermissions = result.fieldPermissions;
      if (result.recordTypeVisibilities) permissionSet.recordTypeVisibilities = result.recordTypeVisibilities;
      if (result.pageAccesses) permissionSet.pageAccesses = result.pageAccesses;
      if (result.tabVisibilities) permissionSet.tabVisibilities = result.tabVisibilities;
      if (result.userPermissions) permissionSet.userPermissions = result.userPermissions;

      const xml = js2xmlparser.parse('PermissionSet', permissionSet, {
        declaration: {
          encoding: 'UTF-8'
        },
      });

      await fs.writeFile(permissionSetPath, xml);
      this.log(messages.getMessage('log.success', [permissionSetPath]));
      return { path: permissionSetPath };
    }catch(err: any){
      this.error(err);
    }
  }
}