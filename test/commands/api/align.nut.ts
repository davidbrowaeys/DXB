import * as path from 'path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as shelljs from 'shelljs';
import { ApiAlignResult } from '../../../src/commands/dxb/api/align';

describe('api align NUTs', () => {
  let session: TestSession;

  beforeEach(async () => {
    session = await TestSession.create({
      project: {
        gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc.git',
      },
    });
    const projectConfig = JSON.parse(fs.readFileSync('sfdx-project.json').toString());
    projectConfig.sourceApiVersion = '57.0';
    fs.writeFileSync('sfdx-project.json', JSON.stringify(projectConfig), { encoding: 'utf8' });
    execCmd('dxb install', { ensureExitCode: 0 });
    shelljs.rm('-rf', 'force-app/main/default/lwc');
  });

  afterEach(async () => {
    await session?.clean();
  });

  it('should align api versions of all metadata files and package directories', async () => {
    const command = 'dxb api align --json';
    const output = await execCmd<ApiAlignResult>(command, { async: true });
    expect(output.jsonOutput?.result.success).to.equal(true);
    fs.readdirSync('force-app/main/default/classes')
      .filter((f) => f.endsWith('meta.xml'))
      .forEach((f) => {
        const metadata = fs.readFileSync(path.join('force-app/main/default/classes', f)).toString();
        expect(metadata?.includes('<apiVersion>57.0</apiVersion>')).to.equal(true);
      });
  });

  it('should exclude certain metadata for alignment', async () => {
    const command = 'dxb api align --metadata-type ApexClass --json';
    const output = await execCmd<ApiAlignResult>(command, { async: true });
    expect(output.jsonOutput?.result.success).to.equal(true);
    fs.readdirSync('force-app/main/default/classes')
      .filter((f) => f.endsWith('meta.xml'))
      .forEach((f) => {
        const metadata = fs.readFileSync(path.join('force-app/main/default/classes', f)).toString();
        expect(metadata?.includes('<apiVersion>57.0</apiVersion>')).to.equal(true);
      });

    fs.readdirSync('force-app/main/default/flows')
      .filter((f) => f.endsWith('meta.xml'))
      .forEach((f) => {
        const metadata = fs.readFileSync(path.join('force-app/main/default/flows', f)).toString();
        expect(metadata?.includes('<apiVersion>57.0</apiVersion>')).to.equal(false);
      });
  });
});
