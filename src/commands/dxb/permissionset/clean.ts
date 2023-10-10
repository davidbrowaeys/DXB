import * as path from 'path';
import * as fs from 'fs-extra';
import {Flags, SfCommand } from '@salesforce/sf-plugins-core';
import * as xml2js from 'xml2js';
import * as js2xmlparser from 'js2xmlparser';
import { Messages } from '@salesforce/core';
type PermSetCleanResult = {
  success: boolean;
}
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'permissionset.clean');
export default class PermSetClean extends SfCommand<PermSetCleanResult> {

  public static readonly summary = messages.getMessage('summary');


  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    file: Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.file.summary'),
      exists: true,
      exclusive: ['root-dir', 'permissionset-name']
    }),
    'permissionset-name': Flags.string({
      char: 'p',
      summary: messages.getMessage('flags.permissionset-name.summary'),
      deprecated: true,
      exclusive: ['file']
    }),
    'root-dir': Flags.directory({
      char: 'r',
      summary: messages.getMessage('flags.root-dir.summary'),
      default: 'force-app/main/default/permissionsets',
      deprecated: true,
      exists: true,
      exclusive: ['file']
    })
  };

  public async run(): Promise<PermSetCleanResult> {
    const {flags} = await this.parse(PermSetClean);

    if (flags['permissionset-name']) {
      await this.cleanPermissionSet(flags['root-dir'], flags['permission-set-name']);
    } else if (flags.file){
      await this.clean(flags.file);
    }else {
      await this.cleanAllPermissionSets(flags['root-dir']);
    }
    return { success: true };
  }

  private async cleanPermissionSet(rootDir: string, permissionSetName: string): Promise<void[]> {
    const permissionSetPaths = this.getPermissionSetPaths(rootDir, permissionSetName);
    const cleanFiles: Array<Promise<void>> = [];
    permissionSetPaths.forEach((filePath) => {
      if (fs.existsSync(filePath)) {
        const permissionSetPath = path.join(rootDir, `${permissionSetName}.${path.extname(filePath)}`);
        cleanFiles.push(this.clean(permissionSetPath));
      } else {
        this.log(messages.getMessage('log.couldNotFind', [filePath]));
      }
    });
    return Promise.all(cleanFiles);
  }

  private async cleanAllPermissionSets(rootDir: string): Promise<void[]> {
    const cleanFiles: Array<Promise<void>> = [];
    fs.readdirSync(rootDir).forEach((fileName) => {
      const fileExt = path.extname(fileName);
      if (fileExt === '.permissionset-meta.xml' || fileExt === '.permissionset') {
        const permissionSetName = fileName.split('.')[0];
        try {
          const permissionSetPath = path.join(rootDir, `${permissionSetName}.${fileExt}`);
          cleanFiles.push(this.clean(permissionSetPath));
        } catch (err: any) {
          this.log(messages.getMessage('log.couldNotCleanup', [permissionSetName, err]));
        }
      }
    });
    return Promise.all(cleanFiles);
  }

  // eslint-disable-next-line class-methods-use-this
  private getPermissionSetPaths(rootDir: string, permissionSetName: string): string[] {
    return [
      path.join(rootDir, `${permissionSetName}.permissionset`),
      path.join(rootDir, `${permissionSetName}.permissionset-meta.xml`)
    ];
  }

  private async clean(permissionSetPath: string): Promise<void> {
    const data = await fs.readFile(permissionSetPath, 'utf8');

    const result = await xml2js.parseStringPromise(data, {
      explicitArray: false,
    });

    this.filterObjectPermissions(result);
    this.filterFieldPermissions(result);
    this.filterClassAccesses(result);
    this.filterPageAccesses(result);
    this.filterUserPermissions(result);
    this.filterRecordTypeVisibilities(result);

    delete result.PermissionSet['$'];
    result.PermissionSet['@'] = {
      xmlns: 'http://soap.sforce.com/2006/04/metadata'
    };
    const xml = js2xmlparser.parse('PermissionSet', result.PermissionSet, {
      declaration: {
        encoding: 'UTF-8'
      },
    });

    return fs.writeFile(permissionSetPath, xml);
  }

  // eslint-disable-next-line class-methods-use-this
  private filterArrayByAttributeValue(arr: any[], attribute: string, value: string): any[] {
    return arr.filter((item) => item[attribute] === value);
  }

  private filterClassAccesses(result: any): void {
    const classAccesses = result.PermissionSet.classAccesses;

    if (!classAccesses) {
      return;
    }

    if (Array.isArray(classAccesses)) {
      result.PermissionSet.classAccesses = this.filterArrayByAttributeValue(classAccesses,'enabled','true');
      if (!result.PermissionSet.classAccesses.length) {
        delete result.PermissionSet.classAccesses;
      }
    } else if (result.PermissionSet.classAccesses.enabled === 'false') {
      delete result.PermissionSet.classAccesses;
    }
  }

  private filterPageAccesses(result: any): void {
    const pageAccesses = result.PermissionSet.pageAccesses;

    if (!pageAccesses) {
      return;
    }

    if (Array.isArray(pageAccesses)) {
      result.PermissionSet.pageAccesses = this.filterArrayByAttributeValue(pageAccesses, 'enabled', 'true');
      if (!result.PermissionSet.pageAccesses.length) {
        delete result.PermissionSet.pageAccesses;
      }
    } else if (result.PermissionSet.pageAccesses.enabled === 'false') {
      delete result.PermissionSet.pageAccesses;
    }
  }


  private filterObjectPermissions(result: any): void {
    this.log(JSON.stringify(result.PermissionSet.objectPermissions));

    const objectPermissions = result.PermissionSet.objectPermissions;

    if (!result.PermissionSet.objectPermissions) {
      return;
    }
    if (Array.isArray(objectPermissions)) {
      result.PermissionSet.objectPermissions = this
      .filterArrayByAttributeValue(objectPermissions, 'allowCreate', 'true')
      .concat(
        this.filterArrayByAttributeValue(objectPermissions, 'allowDelete', 'true'),
        this.filterArrayByAttributeValue(objectPermissions, 'allowEdit', 'true'),
        this.filterArrayByAttributeValue(objectPermissions, 'allowRead', 'true'),
        this.filterArrayByAttributeValue(objectPermissions, 'modifyAllRecords', 'true'),
        this.filterArrayByAttributeValue(objectPermissions, 'viewAllRecords', 'true')
      );
      if (!result.PermissionSet.objectPermissions.length) {
        delete result.PermissionSet.objectPermissions;
      }
    } else if (
      objectPermissions.allowCreate === 'false' &&
      objectPermissions.allowDelete === 'false' &&
      objectPermissions.allowEdit === 'false' &&
      objectPermissions.allowRead === 'false' &&
      objectPermissions.modifyAllRecords === 'false' &&
      objectPermissions.viewAllRecords === 'false'
    ) {
      delete result.PermissionSet.objectPermissions;
    }
  }

  private filterFieldPermissions(result: any): void {
    const fieldPermissions = result.PermissionSet.fieldPermissions;

    if (!fieldPermissions) {
      return;
    }

    if (Array.isArray(fieldPermissions)) {
      result.PermissionSet.fieldPermissions = this
      .filterArrayByAttributeValue(fieldPermissions, 'readable', 'true')
      .concat(this.filterArrayByAttributeValue(fieldPermissions, 'editable', 'true'));

    if (!result.PermissionSet.fieldPermissions.length) {
      delete result.PermissionSet.fieldPermissions;
    }
  } else if (
    fieldPermissions.readable === 'false' &&
    fieldPermissions.editable === 'false'
    ) {
      delete result.PermissionSet.fieldPermissions;
    }
  }

  private filterRecordTypeVisibilities(result: any): void {
    const recordTypeVisibilities = result.PermissionSet.recordTypeVisibilities;

    if (!recordTypeVisibilities) {
      return;
    }

    if (Array.isArray(result.PermissionSet.recordTypeVisibilities)) {
      result.PermissionSet.recordTypeVisibilities = this
      .filterArrayByAttributeValue(recordTypeVisibilities, 'visible', 'true');
      if (!result.PermissionSet.recordTypeVisibilities.length) {
        delete result.PermissionSet.recordTypeVisibilities;
      }
    } else if (recordTypeVisibilities.visible === 'false') {
      delete result.PermissionSet.recordTypeVisibilities;
    }
  }

  private filterUserPermissions(result: any): void {
    const userPermissions = result.PermissionSet.userPermissions;

    if (!userPermissions) {
      return;
    }

    if (Array.isArray(result.PermissionSet.userPermissions)) {
      result.PermissionSet.userPermissions = this
      .filterArrayByAttributeValue(userPermissions, 'enabled', 'true');
      if (!result.PermissionSet.userPermissions.length) {
        delete result.PermissionSet.userPermissions;
      }
    } else if (result.PermissionSet.userPermissions.enabled === 'false') {
      delete result.PermissionSet.userPermissions;
    }
  }
}