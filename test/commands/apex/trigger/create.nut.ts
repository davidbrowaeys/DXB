/* eslint-disable no-console */
import { expect } from 'chai';
import * as fs from 'fs-extra';
import { TestSession, execCmd } from '@salesforce/cli-plugins-testkit';
import { ApexTriggerCreateResult } from '../../../../src/commands/apex/trigger/create';

/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

describe('apex trigger create', () => {
  let testSession: TestSession;

  before(async () => {
    testSession = await TestSession.create({
      project: {
        name: 'MyTestProject',
        apiVersion: '56.0',
      },
    });
  });

  it('should create a trigger with sobject = Account and no source-api-version', async () => {
    const result = (
      await execCmd<ApexTriggerCreateResult>('apex trigger create --sobject Account --json', {
        ensureExitCode: 0,
        async: true,
      })
    ).jsonOutput?.result;
    expect(result?.success).to.equal(true);
    const f = fs.readFileSync('force-app/main/default/triggers/AccountTrigger.trigger-meta.xml').toString();
    expect(f).to.include('<apiVersion>56.0</apiVersion>');
  });

  it('runs apex trigger create with sobject = Account and source-api-version = 58', async () => {
    const result = (
      await execCmd<ApexTriggerCreateResult>('apex trigger create --sobject Account --source-api-version 58 --json', {
        ensureExitCode: 0,
        async: true,
      })
    ).jsonOutput?.result;

    expect(result?.success).to.equal(true);
    const f = fs.readFileSync('force-app/main/default/triggers/AccountTrigger.trigger-meta.xml').toString();
    expect(f).to.include('<apiVersion>58.0</apiVersion>');
  });

  after(async () => {
    await testSession?.clean();
  });
});
