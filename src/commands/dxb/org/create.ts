/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { execSync as exec } from 'child_process';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import {
  SfProject,
  ScratchOrgCreateResult,
  DefaultUserFields,
  User,
  AuthInfo,
  Messages,
  NamedPackageDir,
} from '@salesforce/core';
import * as fs from 'fs-extra';
import { ProjectSetupResult } from '../install';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'org.create');

export type OrgCreateResult = {
  success: boolean;
};

export default class OrgCreate extends SfCommand<OrgCreateResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-dev-hub': Flags.requiredHub(),
    'set-alias': Flags.string({
      char: 'a',
      required: true,
      summary: messages.getMessage('flags.set-alias.summary'),
      aliases: ['orgname'],
      deprecateAliases: true,
    }),
    'include-packages': Flags.boolean({
      char: 'p',
      summary: messages.getMessage('flags.include-packages.summary'),
      aliases: ['includepackages'],
      deprecateAliases: true,
    }),
    'default-org': Flags.boolean({
      char: 's',
      summary: messages.getMessage('flags.default-org.summary'),
      aliases: ['defaultorg'],
      deprecateAliases: true,
    }),
    'duration-days': Flags.integer({
      char: 'd',
      default: 30,
      summary: messages.getMessage('flags.duration-days.summary'),
      min: 1,
      max: 30,
      aliases: ['durationday'],
      deprecateAliases: true,
    }),
    'include-tracking-history': Flags.boolean({
      char: 't',
      summary: messages.getMessage('flags.include-tracking-history.summary'),
      aliases: ['includetrackinghistory'],
      deprecateAliases: true,
    }),
  };

  protected org: any;

  private defaultPackageDir: NamedPackageDir | undefined;

  public async run(): Promise<OrgCreateResult> {
    const { flags } = await this.parse(OrgCreate);
    const project = await SfProject.resolve();
    this.org = flags['target-dev-hub'];
    const config: any = await project.resolveProjectConfig();
    this.defaultPackageDir = project.getDefaultPackage();
    if (!config.plugins?.dxb) {
      throw messages.createError('error.badConfig');
    }
    const dxbConfig: ProjectSetupResult = config.plugins.dxb;

    const orgname = flags['set-alias'];
    const defaultorg = flags['default-org'];
    const durationdays: number = flags['duration-days'] || dxbConfig.defaultdurationdays;
    this.log('\x1b[91m%s\x1b[0m', messages.getMessage('log.welcome', [orgname]));

    let output: ScratchOrgCreateResult | AuthInfo | string | undefined = await this.createScratchOrg(
      orgname,
      defaultorg,
      durationdays
    );
    this.log(output?.warnings.join(', '));

    // UPDATE WORKFLOWS
    this.log(exec(`sf dxb org setdefault --target-org ${orgname}`).toString());

    // DEPLOY PRE LEGACY PACKAGES
    if (dxbConfig.pre_legacy_packages) {
      this.deployLegacyPackages(orgname, dxbConfig.pre_legacy_packages, 'pre');
    }
    if (dxbConfig.deferPermissionSet) {
      this.log(
        exec(
          `sf project deploy start --target-org ${orgname} --source-dir ${dxbConfig.deferPermissionSet} --wait 600`
        ).toString()
      );
    }
    if (dxbConfig.deferSharingUser) {
      this.log(
        exec(
          `sf force user permset assign --perm-set-name ${dxbConfig.deferSharingUser} --target-org ${orgname} --on-behalf-of ${orgname}`
        ).toString()
      );
    }

    if (dxbConfig.userPermissionsKnowledgeUser) {
      this.log(
        exec(
          `sf data update record --sobject User --where "Name='User User'" --values "Country=Australia" --target-org ${orgname}`
        ).toString()
      );
      this.log(
        exec(
          `sf data update record --sobject User --where "Name='User User'" --values "UserPermissionsKnowledgeUser=true" --target-org ${orgname}`
        ).toString()
      );
    }

    // REMOVE FIELDS TRACKING HISTORY
    if (flags['include-tracking-history']) {
      this.includeTrackingHistory(dxbConfig.disableFeedTrackingHistory);
    }

    if (dxbConfig.manual_config_required) {
      // STOP USER FOR MANUAL CONFIG
      await this.promptUserManualConfig(orgname, dxbConfig.manual_steps ?? [], dxbConfig.manual_config_start_url ?? '');
    }

    // INSTALL PACKAGES
    if (flags.includepackages && dxbConfig.packages) {
      this.installPackages(orgname, dxbConfig.packages);
    }

    // PUSH DX SOURCE
    this.log(await this.pushSource(orgname, true));

    // DEPLOY POST LEGACY PACKAGES
    if (dxbConfig.post_legacy_packages) {
      this.deployLegacyPackages(orgname, dxbConfig.post_legacy_packages, 'post');
    }

    // IMPORT DATA
    if (dxbConfig.data_plan_path && fs.existsSync(dxbConfig.data_plan_path)) {
      output = this.importDataPlan(orgname, dxbConfig.data_plan_path);
      this.log(output);
    } else {
      this.log(messages.getMessage('log.noSetupData'));
    }

    if (dxbConfig.default_user_role) {
      const roleResult = JSON.parse(
        exec(
          `sf data query --query "select Id from UserRole where DeveloperName = ${dxbConfig.default_user_role}" --target-org ${orgname} --json`
        ).toString()
      );
      if (roleResult.result?.totalSize === 1) {
        this.log(
          exec(
            `sf data update record --sobject User --where "Name='User User'" --values "UserRoleId=${
              roleResult.result.records[0].Id as string
            }" --target-org ${orgname}`
          ).toString()
        );
      } else {
        this.log(messages.getMessage('log.roleNotFound'));
      }
    }

    // create other user, this also fix FLS being deleted from profile
    if (dxbConfig.user_def_file) {
      output = await this.createUser(orgname, dxbConfig.user_alias_prefix);
      this.log(messages.getMessage('log.userCreated'));
    }
    this.log(exec(`sf org display --target-org ${orgname}`).toString());
    this.log('\x1b[91m%s\x1b[0m', messages.getMessage('log.closing'));
    return { success: true };
  }

  private async createScratchOrg(
    orgname: string,
    defaultorg: boolean,
    durationdays: number
  ): Promise<ScratchOrgCreateResult | undefined> {
    if (!fs.existsSync('./config/project-scratch-def.json')) {
      throw messages.createError('error.definitionFile');
    }

    return await this.org?.scratchOrgCreate({
      alias: orgname,
      setDefault: defaultorg,
      durationDays: durationdays,
      // Fix the file path typo ('./config.project-scratch-def.json' -> './config/project-scratch-def.json')
      orgConfig: JSON.parse(fs.readFileSync('./config/project-scratch-def.json').toString()),
    });
  }

  private deployLegacyPackages(orgname: string, legacyPackages: string[], type: string): void {
    this.log(messages.getMessage('log.packages', [type]));
    try {
      legacyPackages.forEach((elem) => {
        exec(
          `sf project deploy start --metadata-dir config/legacy-packages/${type}/${elem} -target-org ${orgname} --wait 60`
        ).toString();
      });
    } catch (err) {
      throw messages.createError('error.packages', [type]);
    }
  }

  private async promptUserManualConfig(orgname: string, manualSteps: string[], startURL: string): Promise<void> {
    this.log(messages.getMessage('log.manualConfig'));
    manualSteps.forEach((elem) => {
      this.log(elem);
    });
    if (!startURL) {
      startURL = '/lightning/setup/SetupOneHome/home';
    }
    this.log(exec(`sf org open --target-org ${orgname} --path ${startURL}`).toString());
    const prompt = await this.prompt<{ response: string }>({
      type: 'input',
      name: 'response',
      message: messages.getMessage('prompt.message.continue'),
    });
    if (prompt.response.toLowerCase() !== 'y') {
      process.exit();
    }
  }

  private includeTrackingHistory(disableFeedTrackingObjects: string[] | undefined): void {
    disableFeedTrackingObjects?.forEach((elem) => {
      this.log(messages.getMessage('log.trackingHistory', [elem]));
      this.removeFeedTrackingHistoryInObject(elem);
    });
  }

  private removeFeedTrackingHistoryInObject(objectName: string): void {
    const objectPath = `${this.defaultPackageDir?.fullPath}/objects/${objectName}/${objectName}.object-meta.xml`;
    let content = fs.readFileSync(objectPath).toString();
    content = content.replace(
      new RegExp('<enableHistory>.+</enableHistory>', 'g'),
      '<enableHistory>false</enableHistory>'
    );
    fs.writeFileSync(objectPath, content);

    this.removeFeedTrackingHistoryInField(objectName);
  }

  private removeFeedTrackingHistoryInField(objectName: string): void {
    const objectPath = `${this.defaultPackageDir?.fullPath}/objects/${objectName}/fields`;
    fs.readdirSync(objectPath).forEach((file) => {
      let content = fs.readFileSync(objectPath + '/' + file).toString();
      content = content.replace(new RegExp('<trackHistory>.+</trackHistory>', 'g'), '');
      fs.writeFileSync(objectPath + '/' + file, content);
    });
  }

  private async pushSource(orgname: string, usesScratchOrg: boolean | undefined, path?: string): Promise<string> {
    this.log('Push source to org...');
    const command = usesScratchOrg
      ? `sf project deploy start --ignore-warnings --ignore-conflicts --target-org ${orgname}`
      : `sf project deploy start --ignore-warnings --ignore-conflicts --target-org ${orgname} --source-directory ${path}`;
    try {
      return await new Promise((resolve) => resolve(exec(command).toString()));
    } catch (err) {
      throw messages.createError('error.pushFailed');
    }
  }

  private installPackages(orgname: string, packages: string[]): void {
    this.log(messages.getMessage('log.installing'));
    packages.forEach((elem) => {
      try {
        const output = JSON.parse(
          exec(`sf package install --package ${elem} --target-org ${orgname} --wait 60 --json --no-prompt`).toString()
        );
        if (output?.result && output.result.Status === 'SUCCESS') {
          this.log(messages.getMessage('log.installed', [elem]));
        } else {
          throw messages.createError('error.installingPackage', [elem]);
        }
      } catch (err) {
        throw messages.createError('error.installing');
      }
    });
  }

  private async createUser(orgname: string, userAliasPrefix: string | undefined): Promise<AuthInfo> {
    this.log(messages.getMessage('log.createUser'));
    const suffix = Math.floor(Math.random() * 20000000 + 1);
    if (!userAliasPrefix) {
      userAliasPrefix = 'usr';
    }
    try {
      const defaultUserFields = await DefaultUserFields.create({
        templateUser: this.org?.getUsername() ?? '',
        newUserName: `user.${suffix}@dxb-test.${orgname}`,
      });
      const org = this.org;
      const user: User = await User.create({ org });
      return await user.createUser(defaultUserFields.getFields());
    } catch (err) {
      throw messages.createError('error.createUser');
    }
  }

  private importDataPlan(orgname: string, dataplan: string): string {
    this.log(messages.getMessage('log.importData'));
    try {
      return exec(`sf data import tree --plan ${dataplan} --target-org ${orgname} --json`).toString();
    } catch (err) {
      throw messages.createError('error.importData');
    }
  }
}
