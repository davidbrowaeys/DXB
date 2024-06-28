import { execSync as exec } from 'child_process';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'community.publish');

export type CommunityPublishResult = {
  success: boolean;
};

export default class CommunityPublish extends SfCommand<CommunityPublishResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    name: Flags.string({ char: 'n', summary: messages.getMessage('flags.name.summary'), multiple: true }),
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  public static readonly requiresProject = true;

  public async run(): Promise<CommunityPublishResult> {
    const { flags } = await this.parse(CommunityPublish);
    const name = flags.name;
    const username = flags['target-org']?.getUsername();
    if (name) {
      name.forEach((elem) => {
        this.log(exec(`sf community publish --name ${elem} --target-org ${username}`).toString());
      });
    } else {
      const allcommunities = JSON.parse(
        exec(
          `sf data query --query "SELECT Name FROM Network WHERE Status = 'Live'" --result-format json --target-org ${username}`
        ).toString()
      );
      if (allcommunities !== null) {
        allcommunities.result?.records?.forEach((elem: { Name: string }) => {
          this.log(exec(`sf community publish --name ${elem.Name} --target-org ${username}`).toString());
        });
      }
    }
    return { success: true };
  }
}
