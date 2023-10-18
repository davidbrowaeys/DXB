/* eslint-disable no-console */
import { expect } from 'chai';
import * as fs from 'fs-extra';
import { TestSession, execCmd } from '@salesforce/cli-plugins-testkit';
import { ApexTriggerCreationResult } from '../../../../src/commands/dxb/apex/trigger/create';

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

  it('should create a trigger with sobject = Account and no source-api-version', () => {
    const resultA = execCmd<ApexTriggerCreationResult>('dxb:apex:trigger:create --sobject Account --json', {ensureExitCode: 0});
    console.log(resultA);
    const result2A = resultA.jsonOutput;
    console.log(result2A);
    const result3A = result2A!.result;
    console.log(result3A);
    expect(result3A.success).to.equal(true);
    const f = fs.readFileSync('force-app/main/default/triggers/AccountTrigger.trigger-meta.xml').toString();
    expect(f).to.include('<apiVersion>56.0</apiVersion>');
  });

  it('runs apex trigger create with sobject = Account and source-api-version = 58', () => {
    const result = execCmd<ApexTriggerCreationResult>('dxb:apex:trigger:create --sobject Account --source-api-version 58 --json', {ensureExitCode: 0});
    console.log(result);
    const result2 = result.jsonOutput;
    console.log(result2);
    const result3 = result2!.result;
    console.log(result3);
    expect(result3.success).to.equal(true);
    const f = fs.readFileSync('force-app/main/default/triggers/AccountTrigger.trigger-meta.xml').toString();
    expect(f).to.include('<apiVersion>56.0</apiVersion>');
  });

  after(async () => {
    await testSession?.clean();
  });
});