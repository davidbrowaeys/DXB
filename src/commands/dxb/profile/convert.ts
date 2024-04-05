import * as path from 'path';
import * as fs from 'fs-extra';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Parser } from 'xml2js';

export type ProfileConvertResult = {
  success: boolean;
};
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'profile.convert');
export default class ProfileConvert extends SfCommand<ProfileConvertResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'profile-name': Flags.string({
      char: 'p',
      summary: messages.getMessage('flags.profile-name.summary'),
      aliases: ['profilename'],
      deprecateAliases: true,
    }),
    'source-dir': Flags.directory({
      char: 'r',
      summary: messages.getMessage('flags.source-dir.summary'),
      default: 'force-app/main/default/profiles',
      exists: true,
      aliases: ['sourcedir'],
      deprecateAliases: true,
    }),
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  public static readonly requiresProject = true;

  public async run(): Promise<ProfileConvertResult> {
    const { flags } = await this.parse(ProfileConvert);
    let profilename = flags['profile-name'];
    const sourcepath = flags['source-dir'];
    if (profilename) {
      try {
        await this.convertProfile(profilename, sourcepath);
      } catch (err) {
        throw messages.createError('error.couldNotConvert', [profilename]);
      }
    } else {
      const promises = [];
      for (const file of fs.readdirSync(sourcepath)) {
        if (file.includes('profile-meta.xml')) {
          profilename = file.split('.')[0];
          promises.push(this.convertProfile(profilename, sourcepath));
        }
      }
      await Promise.all(promises);
    }
    return { success: true };
  }

  /**
   * Spreads the information in one profile metadata file to directories
   *
   * @param profilename The name of the profile to convert (without .profile-meta.xml extension)
   * @param sourcepath The root of the profile directory
   */
  public async convertProfile(profilename: string, sourcepath: string): Promise<void> {
    const profilepath = path.join(sourcepath, profilename);
    const data = fs.readFileSync(`${profilepath}.profile-meta.xml`, { encoding: 'utf-8' });
    this.log(messages.getMessage('log.readFile', [profilepath]));
    if (!fs.existsSync(profilepath)) {
      fs.mkdirSync(profilepath);
    }
    this.log(messages.getMessage('log.readFile', [profilepath]));
    const parser = new Parser({ explicitArray: false });
    if (!fs.existsSync(`${profilepath}.profile-meta.xml`)) {
      throw messages.createError('error.profileNotExist');
    }
    try {
      const result = await parser.parseStringPromise(data);
      // profile
      fs.writeFileSync(
        profilepath + '/' + profilename + '.json',
        JSON.stringify(
          {
            custom: result.Profile.custom,
            userLicense: result.Profile.userLicense,
            loginHours: result.Profile.loginHours,
            loginIpRanges: result.Profile.loginIpRanges,
            userPermissions: result.Profile.userPermissions,
          },
          null,
          2
        )
      );

      if (!result) {
        throw messages.createError('error.couldNotSplit', [profilename]);
      }
      // applicationVisibilities
      if (result.Profile.applicationVisibilities) {
        this.splitProfile(
          `${profilepath}/applicationVisibilities`,
          result.Profile.applicationVisibilities,
          () => 'application'
        );
      }
      // classAccesses
      if (result.Profile.classAccesses) {
        this.splitProfile(`${profilepath}/classAccesses`, result.Profile.classAccesses, () => 'apexClass');
      }
      // categoryGroupVisibilities
      if (result.Profile.categoryGroupVisibilities) {
        this.splitProfile(
          `${profilepath}/categoryGroupVisibilities`,
          result.Profile.categoryGroupVisibilities,
          () => 'dataCategoryGroup'
        );
      }
      // customMetadataTypeAccesses
      if (result.Profile.customMetadataTypeAccesses) {
        this.splitProfile(
          `${profilepath}/customMetadataTypeAccesses`,
          result.Profile.customMetadataTypeAccesses,
          () => 'name'
        );
      }
      // objectPermissions
      if (result.Profile.objectPermissions) {
        fs.ensureDirSync(profilepath + '/objectPermissions');
        if (!Array.isArray(result.Profile.objectPermissions)) {
          result.Profile.objectPermissions = [result.Profile.objectPermissions];
        }
        result.Profile.objectPermissions.forEach((elem: { object: string }) => {
          fs.ensureDirSync(profilepath + '/objectPermissions/' + elem.object);
          fs.writeFileSync(
            profilepath + '/objectPermissions/' + elem.object + '/' + elem.object + '.json',
            JSON.stringify(elem, null, 2)
          );
        });
      }
      // fieldPermissions
      if (result.Profile.fieldPermissions) {
        this.splitObjectPermissions(
          `${profilepath}/objectPermissions`,
          result.Profile.fieldPermissions,
          'fieldPermissions',
          () => 'field'
        );
      }
      // recordTypeVisibilities
      if (result.Profile.recordTypeVisibilities) {
        this.splitObjectPermissions(
          `${profilepath}/objectPermissions`,
          result.Profile.recordTypeVisibilities,
          'recordTypeVisibilities',
          () => 'recordType'
        );
      }
      // customPermissions
      if (result.Profile.customPermissions) {
        this.splitProfile(`${profilepath}/customPermissions`, result.Profile.customPermissions, () => 'name');
      }
      // customSettingAccesses
      if (result.Profile.customSettingAccesses) {
        this.splitProfile(`${profilepath}/customSettingAccesses`, result.Profile.customSettingAccesses, () => 'name');
      }
      // externalDataSourceAccesses
      if (result.Profile.externalDataSourceAccesses) {
        this.splitProfile(
          `${profilepath}/externalDataSourceAccesses`,
          result.Profile.externalDataSourceAccesses,
          () => 'externalDataSource'
        );
      }
      // flowAccesses
      if (result.Profile.flowAccesses) {
        this.splitProfile(`${profilepath}/flowAccesses`, result.Profile.flowAccesses, () => 'flowName');
      }
      // pageAccesses
      if (result.Profile.pageAccesses) {
        this.splitProfile(`${profilepath}/pageAccesses`, result.Profile.pageAccesses, () => 'apexPage');
      }
      // tabVisibilities
      if (result.Profile.tabVisibilities) {
        this.splitProfile(`${profilepath}/tabVisibilities`, result.Profile.tabVisibilities, () => 'tab');
      }
      // layoutAssignments
      if (result.Profile.layoutAssignments) {
        this.splitProfile(
          `${profilepath}/layoutAssignments`,
          result.Profile.layoutAssignments,
          (elem: { layout: string; recordType: string }) =>
            elem.recordType ? `${elem.layout.split('-')[0]}-${elem.recordType}` : `${elem.layout}`
        );
      }
      this.log(messages.getMessage('log.converted', [profilename]));
    } catch (err: any) {
      this.error('Could not split profile', err);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private splitProfile(profilePath: string, profileSetting: any, determineKey: (e?: any) => string): void {
    fs.ensureDirSync(profilePath);
    if (!Array.isArray(profileSetting)) {
      profileSetting = [profileSetting];
    }
    profileSetting.forEach((elem: any) => {
      const key = determineKey(elem);
      fs.writeFileSync(`${profilePath}/${key}.json`, JSON.stringify(elem, null, 2));
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private splitObjectPermissions(
    objectPath: string,
    profileSetting: any,
    permissionName: string,
    determineKey: (e?: any) => 'field' | 'recordType'
  ): void {
    fs.ensureDirSync(objectPath);
    if (!Array.isArray(profileSetting)) {
      profileSetting = [profileSetting];
    }
    profileSetting.forEach((elem: { field: string; recordType: string }) => {
      const key: 'field' | 'recordType' = determineKey(elem);
      const objectName = elem[key].split('.')[0];
      fs.ensureDirSync(`${objectPath}/${objectName}/${permissionName}`);
      fs.writeFileSync(
        `${objectPath}/${objectName}/${permissionName}/${elem[key]}.json`,
        JSON.stringify(elem, null, 2)
      );
    });
  }
}
