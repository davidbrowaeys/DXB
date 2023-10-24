import * as path from 'path';
import * as fs from 'fs-extra';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import js2xmlparser = require('js2xmlparser');
import { Messages } from '@salesforce/core';

const sortObjKeysAlphabetically = (obj: object): { [k: string]: any } => Object.fromEntries(Object.entries(obj).sort());
const generalSort = (a: any, b: any): number => (b.isDir - a.isDir || a.name > b.name ? -1 : 1);

export type ProfileBuildResult = {
  result: string[];
};
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'profile.build');
export default class ProfileBuild extends SfCommand<ProfileBuildResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'profile-name': Flags.string({ char: 'p', summary: messages.getMessage('flags.profile-name.summary') }),
    'source-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.source-dir.summary'),
      default: 'force-app/main/default/profiles',
    }),
  };

  private sourcepath!: string;

  public async run(): Promise<ProfileBuildResult> {
    const { flags } = await this.parse(ProfileBuild);
    let profilename = flags['profile-name'];
    this.sourcepath = flags['source-dir'];
    if (profilename) {
      return { result: [this.buildProfile(profilename)] };
    } else {
      return {
        result: fs
          .readdirSync(this.sourcepath)
          .sort(generalSort)
          .filter((f: string) => f.includes('profile-meta.xml'))
          .map((file) => {
            profilename = file.split('.')[0];
            return this.buildProfile(profilename);
          }),
      };
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private mapPermissions(profilePath: string, permissionName: string, fileName?: string): any[] {
    if (!fileName && fs.existsSync(`${profilePath}/${permissionName}`)) {
      return (
        fs
          .readdirSync(`${profilePath}/${permissionName}`)
          .sort(generalSort)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          .map((file) => JSON.parse(fs.readFileSync(`${profilePath}/${permissionName}/${file}`).toString()))
      );
    } else if (fileName && fs.existsSync(`${profilePath}/${permissionName}/${fileName}`)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return [JSON.parse(fs.readFileSync(`${profilePath}/${permissionName}/${fileName}`).toString())];
    } else {
      return [];
    }
  }

  private buildProfile(profilename: string): string {
    this.log(profilename);
    const profilepath = path.join(this.sourcepath, profilename);
    // profile
    const profilesetting = JSON.parse(fs.readFileSync(profilepath + '/' + profilename + '.json').toString());

    let profile: any = {
      '@': { xmlns: 'http://soap.sforce.com/2006/04/metadata' },
    };
    if (profilesetting.custom) {
      profile['custom'] = profilesetting.custom;
    }
    if (profilesetting.userLicense) {
      profile['userLicense'] = profilesetting.userLicense;
    }
    if (profilesetting.loginHours) {
      profile['loginHours'] = profilesetting.loginHours;
    }
    if (profilesetting.loginIpRanges) {
      profile['loginIpRanges'] = profilesetting.loginIpRanges;
    }
    // applicationVisibilities
    profile.applicationVisibilities = this.mapPermissions(profilepath, 'applicationVisibilities');

    // classAccess
    profile.classAccesses = this.mapPermissions(profilepath, 'classAccesses');

    // customSettingAccesses
    profile.customSettingAccesses = this.mapPermissions(profilepath, 'customSettingAccesses');

    // externalDataSourceAccesses
    profile.externalDataSourceAccesses = this.mapPermissions(profilepath, 'externalDataSourceAccesses');

    // flowAccesses
    profile.flowAccesses = this.mapPermissions(profilepath, 'flowAccesses');

    // categoryGroupVisibilities
    profile.categoryGroupVisibilities = this.mapPermissions(profilepath, 'categoryGroupVisibilities');

    // customMetadataTypeAccesses
    profile.customMetadataTypeAccesses = this.mapPermissions(profilepath, 'customMetadataTypeAccesses');

    // customPermissions
    profile.customPermissions = this.mapPermissions(profilepath, 'customPermissions');

    // objects
    profile.objectPermissions = [];
    profile.fieldPermissions = [];
    profile.recordTypeVisibilities = [];
    if (fs.existsSync(profilepath + '/objectPermissions')) {
      fs.readdirSync(profilepath + '/objectPermissions')
        .sort(generalSort)
        .forEach((file) => {
          const objectpath = profilepath + '/objectPermissions/' + file;
          // objectPermissions
          profile.objectPermissions = this.mapPermissions(objectpath, 'objectPermissions', `${file}.json`);

          // fieldPermissions
          profile.fieldPermissions = this.mapPermissions(objectpath, 'fieldPermissions');

          // recordTypeVisibilities
          profile.recordTypeVisibilities = this.mapPermissions(objectpath, 'recordTypeVisibilities');
        });
    }
    // layoutAssignments
    profile.layoutAssignments = this.mapPermissions(profilepath, 'layoutAssignments');

    // pageAccesses
    profile.pageAccesses = this.mapPermissions(profilepath, 'pageAccesses');

    // tabVisibilities
    profile.tabVisibilities = this.mapPermissions(profilepath, 'tabVisibilities');

    // user permissions
    if (profilesetting.userPermissions) {
      profile['userPermissions'] = profilesetting.userPermissions;
    }
    // sort profile attributes
    profile = sortObjKeysAlphabetically(profile);
    const xml = js2xmlparser.parse('Profile', profile, { declaration: { encoding: 'UTF-8' } });
    const fullPath = `${this.sourcepath}/${profilename}.profile-meta.xml`;
    fs.writeFileSync(fullPath, xml);
    return fullPath;
  }
}
