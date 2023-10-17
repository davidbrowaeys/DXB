/* eslint-disable no-console */
// import * as puppeteer from 'puppeteer';
import { execSync as exec } from 'child_process';
interface Frame {
  name(): string;
}
export class PuppeteerSFConnector{
  private username: any;
  private options: any;
  private browser: any;
  private page: any;

  public constructor(username: any, options: any){
    if (!username){
      throw new Error('Missing argument: connection');
    }
    this.username = username;
    this.options = options;
  }

  public async initBrowser(): Promise<void> {
    try{
      console.log('Initialise Browser');
      // this.browser = await puppeteer.launch({
      // 	args: ['--disable-features=site-per-process'],
      // 	headless: this.options.cliOnly //set headless to false if you want to open browser
      // });
      this.page = await this.browser.newPage();
      await this.page.setDefaultNavigationTimeout(this.options.defaultNavigationTimeout);
    }catch(err){
      console.error(err);
      throw new Error('Connection failed');
    }
  }

  public async closeBroswer(): Promise<void> {
    await this.browser.close();
  }

  public async enableExperienceBundle(): Promise<void> {
    const pageUrl = this.fetchSalesforcePageUrl('/lightning/setup/NetworkSettings/home');
    await this.page.goto(pageUrl, { waitUntil: 'networkidle2' });
    // because LEX page content is rendered in iframe
    await this.page.waitForSelector('iframe');
    const frameOrPage = (await this.page.frames().find((f: Frame) => f.name().startsWith('vfFrameId'))) || this.page;
    // promise all to make sure it wait for each promise to complete
    await Promise.all([
      this.page.waitForNavigation(),
      frameOrPage.$eval('input[name="pEnableExperienceBundleMetadata"]', (input: { checked: boolean }) => { input.checked = true }),
      frameOrPage.click('input[name="save"]'),
    ]);
    console.log('Experience Bundle: enabled!');
  }

  public async suspendDeferSharing(): Promise<void> {
    const pageUrl = this.fetchSalesforcePageUrl('/lightning/setup/DeferSharingCalculations/home');
    await this.page.goto(pageUrl, { waitUntil: 'networkidle2' });
    // because LEX page content is rendered in iframe
    await this.page.waitForSelector('iframe');
    const frameOrPage = (await this.page.frames().find((f: Frame) => f.name().startsWith('vfFrameId'))) || this.page;
    // promise all to make sure it wait for each promise to complete
    await Promise.all([
      this.page.waitForNavigation(),
      frameOrPage.click('input[name="rule_suspend"]')
    ]);
    console.log('Sharing Rule Calculation: suspended!');
  }

  public async resumeDeferSharing(): Promise<void> {
    const pageUrl = this.fetchSalesforcePageUrl('/lightning/setup/DeferSharingCalculations/home');
    await this.page.goto(pageUrl, { waitUntil: 'networkidle2' });
    // because LEX page content is rendered in iframe
    await this.page.waitForSelector('iframe');
    const frameOrPage = (await this.page.frames().find((f: Frame) => f.name().startsWith('vfFrameId'))) || this.page;
    // promise all to make sure it wait for each promise to complete
    await Promise.all([
      this.page.waitForNavigation(),
      frameOrPage.click('input[name="rule_resume"]')
    ]);
    console.log('Sharing Rule Calculation: resumed!');
  }

  public async recalculatedDeferSharing(): Promise<void> {
    const pageUrl = this.fetchSalesforcePageUrl('/lightning/setup/DeferSharingCalculations/home');
    await this.page.goto(pageUrl, { waitUntil: 'networkidle2' });
    // because LEX page content is rendered in iframe
    await this.page.waitForSelector('iframe');
    const frameOrPage = (await this.page.frames().find((f: Frame) => f.name().startsWith('vfFrameId'))) || this.page;
    // promise all to make sure it wait for each promise to complete
    await Promise.all([
      this.page.waitForNavigation(),
      frameOrPage.click('input[name="rule_recalc"]')
    ]);
    console.log('Sharing Rule Calculation: recalculating!');
  }

  public async enableLoginAsAnyUser(): Promise<void> {
    try{
      const pageUrl = this.fetchSalesforcePageUrl('/lightning/setup/LoginAccessPolicies/home');
      await this.page.goto(pageUrl, { waitUntil: 'networkidle2' });
      // because LEX page content is rendered in iframe
      await this.page.waitForSelector('iframe');
      const frameOrPage = (await this.page.frames().find((f: Frame) => f.name().startsWith('vfFrameId'))) || this.page;
      // promise all to make sure it wait for each promise to complete
      await frameOrPage.waitForNavigation();
      await frameOrPage.$eval('input[name="loginAccessPolicies:mainForm:j_id17:adminTable:0:adminsCanLogInAsAny"]', (input: { checked: boolean }) => { input.checked = true });
      await frameOrPage.click('input[name="loginAccessPolicies:mainForm:j_id17:j_id22:save"]');			// click on save

      console.log('Administrators Can Log in as Any User: enabled');
    }catch(err){
      console.error(err);
      throw new Error('Connection failed');
    }
  }

  public async enableSamlForSSO(): Promise<void> {
    const pageUrl = this.fetchSalesforcePageUrl('/lightning/setup/SingleSignOn/home');
    await this.page.goto(pageUrl, { waitUntil: 'networkidle2' });
    // because LEX page content is rendered in iframe
    await this.page.waitForSelector('iframe');
    const frameOrPage = (await this.page.frames().find((f: Frame) => f.name().startsWith('vfFrameId'))) || this.page;
    // promise all to make sure it wait for each promise to complete
    await frameOrPage.waitForSelector('input[name="edit"]');
    await frameOrPage.waitForSelector('input[name="p20"]');
    await frameOrPage.$eval('input[name="p20"]', (input: { checked: boolean }) => { input.checked = true });
    await frameOrPage.click('input[name="save"]');

    console.log('Single Sign On - SAML: enabled');
  }

  public fetchSalesforcePageUrl(url: string): string{
    const command = `sfdx force:org:open -r -p ${url} -u ${this.username} --json`;
    console.log('Opening:',command);
    const sfPage: { result: { url: string } } = JSON.parse(exec(command).toString());
    return sfPage.result.url;
  }
}