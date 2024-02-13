import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import * as fs from 'fs-extra';
import { ProjectSetupResult } from '../../src/commands/dxb/install';

describe('install NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({ devhubAuthStrategy: 'NONE', project: {} });
  });

  after(async () => {
    await session?.clean();
  });

  it('should update the sfdx-project.json file with --json', async () => {
    const command = 'dxb install --json';
    const result = execCmd<ProjectSetupResult>(command, { ensureExitCode: 0 });
    const output: ProjectSetupResult = result.jsonOutput?.result ?? { defaultdurationdays: -1 };
    const config = JSON.parse(fs.readFileSync('sfdx-project.json').toString());
    expect(config).to.have.property('plugins');
    expect(config.plugins).to.have.property('dxb');
    expect(Object.keys(config.plugins.dxb).toString()).to.equal(Object.keys(output).toString());
  });
  it('should update the sfdx-project.json file without --json', async () => {
    const command = 'dxb install';
    const result = execCmd<ProjectSetupResult>(command, { ensureExitCode: 0 });
    const consoleOutput = result.shellOutput;
    expect(consoleOutput).to.contain('Welcome to DXB CLI! Happy coding!');
  });
});
