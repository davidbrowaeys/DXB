import { TestContext } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import * as fs from 'fs-extra';
import ApexTriggerCreation from '../../../../src/commands/dxb/apex/trigger/create';

describe('apex trigger create', () => {
  const $$ = new TestContext();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('runs apex trigger create with sobject = Account and no source-api-version', async () => {
    const result = await ApexTriggerCreation.run(['--sobject', 'Account']);
    expect(result.success).to.equal(true);
    const output = sfCommandStubs.log
      .getCalls()
      .flatMap((c) => c.args)
      .join('\n');
    expect(output).to.include('The following files were created:').and.to.include('AccountTrigger.trigger');
  });

  it('runs apex trigger create with sobject = Account and source-api-version = 56', async () => {
    const result = await ApexTriggerCreation.run(['--sobject', 'Account', '--source-api-version', '56']);
    expect(result.success).to.equal(true);
    const output = sfCommandStubs.log
      .getCalls()
      .flatMap((c) => c.args)
      .join('\n');
    expect(output).to.include('The following files were created:').and.to.include('AccountTrigger.trigger');
    const f = fs.readFileSync('force-app/main/default/triggers/AccountTrigger.trigger-meta.xml').toString();
    expect(f).to.include('<apiVersion>56.0</apiVersion>');
  });
});
