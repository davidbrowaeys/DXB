import { TestSession } from '@salesforce/cli-plugins-testkit';

describe('static create NUTs', () => {
  let session: TestSession;

  beforeEach(async () => {
    session = await TestSession.create({
      project: {
        gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc.git',
      },
    });
  });

  afterEach(async () => {
    await session?.clean();
  });

  it('should create a static resource', async () => {
    // const name = 'TestStatic';
    // const fileName = 'teststatic.png';
    // const command = `static create --name ${name} --file ${fileName} --target-dir src/staticresources`;
    // const output = await execInteractiveCmd(
    //   command,
    //   {
    //     'Description: ': ['teststatic', Interaction.ENTER],
    //     'Content Type: ': ['image/png', Interaction.ENTER],
    //     'Cache Control(Public|Private): ': ['Private', Interaction.ENTER],
    //   },
    //   { ensureExitCode: 0 }
    // );
    // console.log(output);
    // const createdFiles = fs.readdirSync('src/staticresources');
    // expect(createdFiles.length).to.equal(2);
    // expect(createdFiles.toString()).to.contain('teststatic.png').and.to.contain('teststatic.resource-meta.xml');
    // const metadatafile = fs.readFileSync('teststatic.resource-meta.xml').toString();
    // expect(metadatafile.includes('Private')).to.equal(true);
  });
});
