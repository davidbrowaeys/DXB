//import * as puppeteer from 'puppeteer';
import { execSync as exec } from 'child_process';

export class PuppeteerSFConnector{
	username:any;
    options:any;
    browser;
    page;
    constructor(username:any, options:any){
		if (!username){
			throw new Error('Missing argument: connection');
        }
		this.username = username;
        this.options = options;
    }
    async initBrowser(){
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
	async closeBroswer(){
		await this.browser.close();
	}
    async enableExperienceBundle(){
		const pageUrl = this.fetchSalesforcePageUrl('/ightning/setup/NetworkSettings/home');
        await this.page.goto(pageUrl, { waitUntil: 'networkidle2' });
		//because LEX page content is rendered in iframe
		await this.page.waitForSelector('iframe');
		const frameOrPage = (await this.page.frames().find(f => f.name().startsWith('vfFrameId'))) || this.page;
		//promise all to make sure it wait for each promise to complete
		await Promise.all([
			this.page.waitForNavigation(),
			frameOrPage.$eval('input[name="pEnableExperienceBundleMetadata"]', (input) => { input.checked = true }),
			frameOrPage.click('input[name="save"]'),
		]);
		console.log('Experience Bundle: enabled!');
    }
    async suspendDeferSharing(){
		const pageUrl = this.fetchSalesforcePageUrl('/lightning/setup/DeferSharingCalculations/home');
        await this.page.goto(pageUrl, { waitUntil: 'networkidle2' });
		//because LEX page content is rendered in iframe
		await this.page.waitForSelector('iframe');
		const frameOrPage = (await this.page.frames().find(f => f.name().startsWith('vfFrameId'))) || this.page;
		//promise all to make sure it wait for each promise to complete
		await Promise.all([
			this.page.waitForNavigation(),
			frameOrPage.click('input[name="rule_suspend"]')
		]);
		console.log('Sharing Rule Calculation: suspended!');
    }
    async resumeDeferSharing(){
		const pageUrl = this.fetchSalesforcePageUrl('/lightning/setup/DeferSharingCalculations/home');
        await this.page.goto(pageUrl, { waitUntil: 'networkidle2' });
		//because LEX page content is rendered in iframe
		await this.page.waitForSelector('iframe');
		const frameOrPage = (await this.page.frames().find(f => f.name().startsWith('vfFrameId'))) || this.page;
		//promise all to make sure it wait for each promise to complete
		await Promise.all([
			this.page.waitForNavigation(),
			frameOrPage.click('input[name="rule_resume"]')
		]);
		console.log('Sharing Rule Calculation: resumed!');
    }
    async recalculatedDeferSharing(){
		const pageUrl = this.fetchSalesforcePageUrl('/lightning/setup/DeferSharingCalculations/home');
        await this.page.goto(pageUrl, { waitUntil: 'networkidle2' });
		//because LEX page content is rendered in iframe
		await this.page.waitForSelector('iframe');
		const frameOrPage = (await this.page.frames().find(f => f.name().startsWith('vfFrameId'))) || this.page;
		//promise all to make sure it wait for each promise to complete
		await Promise.all([
			this.page.waitForNavigation(),
			frameOrPage.click('input[name="rule_recalc"]')
		]);
		console.log('Sharing Rule Calculation: recalculating!');
    }
    async enableLoginAsAnyUser(){
		try{
			const pageUrl = this.fetchSalesforcePageUrl('/lightning/setup/LoginAccessPolicies/home');
			await this.page.goto(pageUrl, { waitUntil: 'networkidle2' });
		//because LEX page content is rendered in iframe
			await this.page.waitForSelector('iframe');
			const frameOrPage = (await this.page.frames().find(f => f.name().startsWith('vfFrameId'))) || this.page;
			//promise all to make sure it wait for each promise to complete
			await frameOrPage.waitForNavigation();
			await frameOrPage.$eval('input[name="loginAccessPolicies:mainForm:j_id17:adminTable:0:adminsCanLogInAsAny"]', (input) => { input.checked = true });
			await frameOrPage.click('input[name="loginAccessPolicies:mainForm:j_id17:j_id22:save"]');			//click on save

			console.log('Administrators Can Log in as Any User: enabled');
		}catch(err){
			console.error(err);
			throw new Error('Connection failed');
		}
    }
    async enableSamlForSSO(){
		const pageUrl = this.fetchSalesforcePageUrl('/lightning/setup/SingleSignOn/home');
        await this.page.goto(pageUrl, { waitUntil: 'networkidle2' });
		//because LEX page content is rendered in iframe
		await this.page.waitForSelector('iframe');
		const frameOrPage = (await this.page.frames().find(f => f.name().startsWith('vfFrameId'))) || this.page;
		//promise all to make sure it wait for each promise to complete
		await frameOrPage.waitForSelector('input[name="edit"]');
		await frameOrPage.waitForSelector('input[name="p20"]');
		await frameOrPage.$eval('input[name="p20"]', (input) => { input.checked = true });
		await frameOrPage.click('input[name="save"]');

		console.log('Single Sign On - SAML: enabled');
    }
	fetchSalesforcePageUrl(url:string){
		const command = `sfdx force:org:open -r -p ${url} -u ${this.username} --json`;
		console.log('Opening:',command);
		const sfPage = JSON.parse(exec(command).toString());
		return sfPage.result.url;
	}
}