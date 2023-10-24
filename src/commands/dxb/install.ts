/* eslint-disable camelcase */
import * as path from 'path';
import * as fs from 'fs-extra';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
type MetadataRule = {
  regex: string;
  replaceby: string;
  mergefield?: string;
};
type MetadataConfig = {
  folder: string;
  rules: MetadataRule[];
};
export type ProjectSetupResult = {
  apextemplatepath?: string;
  apiAlignmentExclusion?: string[];
  data_plan_path?: string;
  defaultdurationdays: number;
  default_user_role?: string;
  deferPermissionSet?: string;
  deferSharingUser?: string;
  disableFeedTrackingHistory?: string[];
  manual_config_required?: boolean;
  manual_config_start_url?: string;
  manual_steps?: string[];
  orgdefault_config?: MetadataConfig[];
  packages?: string[];
  post_legacy_packages?: string[];
  pre_legacy_packages?: string[];
  userPermissionsKnowledgeUser?: boolean;
  user_alias_prefix?: string;
  user_def_file?: string;
};
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'install');
export default class ProjectSetup extends SfCommand<ProjectSetupResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  public static readonly requiresProject = true;

  public async run(): Promise<ProjectSetupResult> {
    await this.parse(ProjectSetup);
    this.spinner.start(messages.getMessage('spinner.start.setup'));
    const init: ProjectSetupResult = {
      apiAlignmentExclusion: [],
      defaultdurationdays: 30,
      packages: [],
      pre_legacy_packages: [],
      userPermissionsKnowledgeUser: false,
      deferPermissionSet: undefined,
      deferSharingUser: undefined,
      disableFeedTrackingHistory: [],
      manual_config_required: false,
      manual_config_start_url: '/ltng/switcher?destination=classic&referrer=%2Flightning%2Fsetup%2FSetupOneHome%2Fhome',
      manual_steps: ['- Sample: Chatter Settings > Enable Unlisted Groups'],
      data_plan_path: './data/sample/data-plan.json',
      apextemplatepath: undefined,
      orgdefault_config: [
        {
          folder: 'workflows',
          rules: [
            {
              regex: '<lookupValue>.+</lookupValue>',
              replaceby: '<lookupValue>{{mergevalue}}</lookupValue>',
              mergefield: 'username',
            },
            {
              regex: '<senderType>.+</senderType>',
              replaceby: '<senderType>CurrentUser</senderType>',
            },
          ],
        },
        {
          folder: 'emailservices',
          rules: [
            {
              regex: '<runAsUser>.+</runAsUser>',
              replaceby: '<runAsUser>{{mergevalue}}</runAsUser>',
              mergefield: 'username',
            },
          ],
        },
        {
          folder: 'autoResponseRules',
          rules: [
            {
              regex: '<senderEmail>.+</senderEmail>',
              replaceby: '<senderEmail>{{mergevalue}}</senderEmail>',
              mergefield: 'username',
            },
            {
              regex: '<senderEmail>.+</senderEmail>',
              replaceby: '<senderEmail>{{mergevalue}}</senderEmail>',
              mergefield: 'username',
            },
          ],
        },
        {
          folder: 'dashboards',
          rules: [
            {
              regex: '<dashboardType>LoggedInUser</dashboardType>',
              replaceby: '<dashboardType>SpecifiedUser</dashboardType>',
            },
          ],
        },
        {
          folder: 'approvalProcesses',
          rules: [
            {
              regex: '<name>.+</name><!--username-->',
              replaceby: '<name>{{mergevalue}}</name>',
              mergefield: 'username',
            },
          ],
        },
      ],
    };

    const config: any = JSON.parse(fs.readFileSync('sfdx-project.json').toString());
    if (!config.plugins) {
      config['plugins'] = {};
    }
    config['plugins']['dxb'] = init;
    fs.writeFileSync('sfdx-project.json', JSON.stringify(config, null, 2));
    this.log(messages.getMessage('log.dxbAdded'));
    const dxbSchemaGen = JSON.parse(fs.readFileSync(path.join(__dirname, '../../utils/documentinfo.json')).toString());
    fs.writeFileSync('config/dxb-schemagen-def.json', JSON.stringify(dxbSchemaGen, null, 2));
    this.log(messages.getMessage('log.schemagen'));
    this.spinner.stop(messages.getMessage('spinner.stop.done'));
    this.log('\x1b[34m\x1b[45m\x1b[5m%s', '\n\n' + messages.getMessage('log.welcome') + '\n\n');
    return init;
  }
}
