import { SfdxCommand, flags } from '@salesforce/command';
import { Connection } from '@salesforce/core';
import * as path from 'path';
import * as fs from 'fs';
import * as pdf from 'pdf-creator-node';
const ORGQUERY = "SELECT WebToCaseDefaultOrigin, UsesStartDateAsFiscalYearName, UiSkin, TrialExpirationDate, TimeZoneSidKey, SystemModstamp, Street, State, SignupCountryIsoCode, ReceivesInfoEmails, ReceivesAdminInfoEmails, PrimaryContact, PreferencesTransactionSecurityPolicy, PreferencesTerminateOldestSession, PreferencesRequireOpportunityProducts, PreferencesOnlyLLPermUserAllowed, PreferencesLightningLoginEnabled, PreferencesConsentManagementEnabled, PreferencesAutoSelectIndividualOnMerge, PostalCode, Phone, OrganizationType, NumKnowledgeService, NamespacePrefix, Name, MonthlyPageViewsUsed, MonthlyPageViewsEntitlement, Longitude, Latitude, LastModifiedDate, LastModifiedById, LanguageLocaleKey, IsSandbox, IsReadOnly, InstanceName, Id, GeocodeAccuracy, FiscalYearStartMonth, Fax, Division, DefaultPricebookAccess, DefaultOpportunityAccess, DefaultLocaleSidKey, DefaultLeadAccess, DefaultContactAccess, DefaultCaseAccess, DefaultCampaignAccess, DefaultCalendarAccess, DefaultAccountAccess, CreatedDate, CreatedById, Country, ComplianceBccEmail, City, Address FROM Organization";
const STDQUERY = "SELECT Id, DurableId, LastModifiedDate, LastModifiedById, QualifiedApiName, NamespacePrefix, DeveloperName, MasterLabel, Label, PluralLabel, DefaultCompactLayoutId, IsCustomizable, IsApexTriggerable, IsWorkflowEnabled, IsProcessEnabled, IsCompactLayoutable, DeploymentStatus, KeyPrefix, IsCustomSetting, IsDeprecatedAndHidden, IsReplicateable, IsRetrieveable, IsSearchLayoutable, IsSearchable, IsTriggerable, IsIdEnabled, IsEverCreatable, IsEverUpdatable, IsEverDeletable, IsFeedEnabled, IsQueryable, IsMruEnabled, DetailUrl, EditUrl, NewUrl, EditDefinitionUrl, HelpSettingPageName, HelpSettingPageUrl, RunningUserEntityAccessId, PublisherId, IsLayoutable, RecordTypesSupported, InternalSharingModel, ExternalSharingModel, HasSubtypes, IsSubtype, IsAutoActivityCaptureEnabled, IsInterface, ImplementsInterfaces, ImplementedBy, ExtendsInterfaces, ExtendedBy, DefaultImplementation FROM EntityDefinition WHERE QualifiedApiName IN ('{{stdobject}}') ORDER BY NamespacePrefix, QualifiedApiName LIMIT 2000";
const CUSTOMQUERY = "SELECT Id, DurableId, LastModifiedDate, LastModifiedById, QualifiedApiName, NamespacePrefix, DeveloperName, MasterLabel, Label, PluralLabel, DefaultCompactLayoutId, IsCustomizable, IsApexTriggerable, IsWorkflowEnabled, IsProcessEnabled, IsCompactLayoutable, DeploymentStatus, KeyPrefix, IsCustomSetting, IsDeprecatedAndHidden, IsReplicateable, IsRetrieveable, IsSearchLayoutable, IsSearchable, IsTriggerable, IsIdEnabled, IsEverCreatable, IsEverUpdatable, IsEverDeletable, IsFeedEnabled, IsQueryable, IsMruEnabled, DetailUrl, EditUrl, NewUrl, EditDefinitionUrl, HelpSettingPageName, HelpSettingPageUrl, RunningUserEntityAccessId, PublisherId, IsLayoutable, RecordTypesSupported, InternalSharingModel, ExternalSharingModel, HasSubtypes, IsSubtype, IsAutoActivityCaptureEnabled, IsInterface, ImplementsInterfaces, ImplementedBy, ExtendsInterfaces, ExtendedBy, DefaultImplementation FROM EntityDefinition WHERE DeploymentStatus != null AND IsCustomizable = TRUE ORDER BY NamespacePrefix, QualifiedApiName";
const FIELDQUERY = "SELECT Id, EntityDefinitionId, EntityDefinition.QualifiedApiName, DurableId, QualifiedApiName, NamespacePrefix, DeveloperName, MasterLabel, Label, Length, DataType, ServiceDataTypeId, ValueTypeId, ExtraTypeInfo, IsCalculated, IsHighScaleNumber, IsHtmlFormatted, IsNameField, IsNillable, IsWorkflowFilterable, IsCompactLayoutable, Precision, Scale, IsFieldHistoryTracked, IsIndexed, IsApiFilterable, IsApiSortable, IsListFilterable, IsListSortable, IsApiGroupable, IsListVisible, ControllingFieldDefinitionId, LastModifiedDate, LastModifiedById, PublisherId, RunningUserFieldAccessId, RelationshipName, ReferenceTo, ReferenceTargetField, IsCompound, IsSearchPrefilterable, IsPolymorphicForeignKey, IsAiPredictionField, BusinessOwnerId, BusinessStatus, SecurityClassification, ComplianceGroup, Description FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName IN ({{object_name}}) ORDER BY NamespacePrefix, QualifiedApiName";
const AUTOFLOWQUERY = "SELECT Id, ApiName, Label, Description, ProcessType, TriggerType, TriggerOrder, Environments, Builder, ManageableState, RecordTriggerType, TriggerObjectOrEventLabel, TriggerObjectOrEventId, IsActive, ActiveVersionId, OverriddenFlowId, VersionNumber FROM FlowDefinitionView WHERE ProcessType = 'AutoLaunchedFlow' AND Builder = 'Flow Builder' AND ManageableState = 'unmanaged' AND TriggerObjectOrEventId IN ({{object_name}}) ORDER BY Label";
const FLOWQUERY = "SELECT Id, ApiName, Label, Description, ProcessType, TriggerType, TriggerOrder, Environments, Builder, ManageableState, RecordTriggerType, TriggerObjectOrEventLabel, TriggerObjectOrEventId, IsActive, ActiveVersionId, OverriddenFlowId, VersionNumber FROM FlowDefinitionView WHERE Builder = 'Flow Builder' AND ManageableState = 'unmanaged' AND TriggerObjectOrEventId = null ORDER BY Label";
const APEXCLSQUERY = "SELECT Id, Name, ApiVersion, Status, Body, IsValid, LengthWithoutComments FROM ApexClass WHERE NamespacePrefix = null ORDER BY Name";
const APEXTRGQUERY = "SELECT UsageBeforeInsert, UsageAfterInsert, UsageBeforeUpdate, UsageAfterUpdate, UsageBeforeDelete, UsageAfterDelete, UsageIsBulk, UsageAfterUndelete, ApiVersion, Status, TableEnumOrId, Name, Id, Body FROM ApexTrigger where NamespacePrefix = null"
const NAMEDCREDQUERY = "SELECT Id, DeveloperName, Endpoint, PrincipalType, Language, MasterLabel, AuthTokenEndpointUrl, JwtIssuer FROM NamedCredential";
const CONNECTEDAPPQUERY = "SELECT Id, Name, MobileStartUrl, RefreshTokenValidityPeriod, UvidTimeout, OptionsAllowAdminApprovedUsersOnly, OptionsRefreshTokenValidityMetric, MobileSessionTimeout, OptionsCodeCredentialGuestEnabled, OptionsFullContentPushNotifications, OptionsAllowExpiredUvidJWT, OptionsIsInternal, OptionsHasSessionLevelPolicy, PinLength, StartUrl FROM ConnectedApplication";
export default class SchemaDocGen extends SfdxCommand {

    public static description = 'This command-line can generate technical design documentation for a Salesforce org. The tool retrieves metadata information about standard and custom objects, Apex classes, triggers, REST resources, named credentials, and connected apps from the org and then creates a PDF document containing the collected information. The tool uses the pdfmake library to generate the PDF document based on an HTML template and a CSS stylesheet.';

    public static examples = [
        'sfdx dxb:schema:generate:doc -u myenv -c config/documentinfo.json'
    ];

    public static args = [{ name: 'file' }];

    protected static flagsConfig = {
        pdfconfig:flags.string({
            char: 'c',
            description: 'A required string parameter that represents the file path of a JSON configuration file for the PDF document generation.',
            required:true
        }),
        stylesheet: flags.string({
            char: 's',
            description: 'An optional string parameter that represents the file path of a stylesheet for the generated HTML document. If not specified, the default Bootstrap stylesheet will be used'
        }),
        htmltemplate: flags.string({
            char: 't',
            description: ' An optional string parameter that represents the file path of an HTML template for the PDF document generation. If not specified, the default DXB template will be used.'
        }),
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;

    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;

    protected connection:Connection;

    public async run(): Promise<void> {
        const { pdfconfig, stylesheet, htmltemplate } = this.flags;

        // Ensure required files exist
        const htmlPath = htmltemplate ?? path.join(__dirname, '../../../../../src/lib/schema-template.html');
        const cssPath = stylesheet ?? path.join(__dirname, '../../../../../src/lib/bootstrap.min.css');
        if (!fs.existsSync(htmlPath)) throw new Error(`HTML Template not found: ${htmlPath}`);
        if (!fs.existsSync(cssPath)) throw new Error(`Stylesheet file not found: ${cssPath}`);
        if (!fs.existsSync(pdfconfig)) throw new Error(`PDF Metadata Config Json file not found: ${pdfconfig}`);
        // Parse PDF metadata configuration
        const documentMeta = JSON.parse(fs.readFileSync(pdfconfig, 'utf8'));
        if (!documentMeta.metadata?.stdobjects || !Array.isArray(documentMeta.metadata.stdobjects)) {
            throw new Error(`You must define list of standard objects as follow "metadata": { stdobjects: ["Account","Contact"]} in your pdf document:${pdfconfig}`);
        }
        // Connect to org
        this.connection = this.org.getConnection();
        //retrieve objects informatin
        this.ux.startSpinner('Retrieve organization info');
        let orginfo = await this.query(ORGQUERY);
        const ssoSettings = await this.getSSOSettingMetadata();
        this.ux.stopSpinner(`Done`);
        this.ux.startSpinner('Retrieve standard object list');
        let std_objects = await this.query(STDQUERY.split('{{stdobject}}').join(documentMeta.metadata.stdobjects.join("','")));
        this.ux.stopSpinner(`${std_objects.length} found!`);
        this.ux.startSpinner('Retrieve standard object metadata');
        std_objects = await this.getObjectDefinition(std_objects, 'CustomObject',documentMeta.metadata.stdobjects);
        this.ux.stopSpinner(`Done`);
        this.ux.startSpinner('Retrieve custom object list');
        let cust_objects = await this.query(CUSTOMQUERY);
        cust_objects = cust_objects.filter((e:any)=> !e.NamespacePrefix);
        this.ux.stopSpinner(`${cust_objects.length} found!`);
        this.ux.startSpinner('Retrieve custom object metadata');
        cust_objects = await this.getObjectDefinition(cust_objects, 'CustomObject',cust_objects.map( (e:any) =>{ return e.QualifiedApiName;}));
        this.ux.stopSpinner(`Done`);

        this.ux.startSpinner('Retrieve flows and process builders');
        const flows = this.processFlow(await (await this.getFlowDefinitions()).flat());
        this.ux.stopSpinner(`${flows.length} found!`);

        // Retrieve Apex classes, triggers, and REST resources
        this.ux.startSpinner('Retrieve Apex classes and triggers');
        const apexClasses = await this.getApexClasses();
        const apexTestClasses = apexClasses.filter(cls => cls.Body.toLowerCase().includes('@istest'));
        const apexTriggers = await this.query(APEXTRGQUERY);
        std_objects = await this.getTriggerForSObject(std_objects, apexTriggers);
        cust_objects = await this.getTriggerForSObject(cust_objects, apexTriggers);
        const apexRestResource = apexClasses.filter(cls => cls.Body.includes('@RestResource'))
            .map(cls => {
                const urlMappingValue = cls.Body.match(/urlMapping=['"]([^'"]+)['"]/)?.[1];
                return { ...cls, urlMappingValue };
            })
            .filter(cls => !!cls.urlMappingValue);
        this.ux.stopSpinner(`${apexClasses.length} found!`);

        //retrieve integration settings
        this.ux.startSpinner('Retrieve name credentials');
        let namedCredentials = await this.query(NAMEDCREDQUERY);
        this.ux.stopSpinner(`${namedCredentials.length} found!`);
        this.ux.startSpinner('Retrieve connected apps');
        let connectedApps:any = await this.getConnectedAppUsage( await this.query(CONNECTEDAPPQUERY) );
        this.ux.stopSpinner(`${connectedApps.length} found!`);
        
        // finalizing and create actual documet
        await this.createPdfDocument({
            orginfo,
            ssoSettings,
            std_objects,
            cust_objects,
            apexClasses,
            apexRestResource,
            apexTestClasses,
            connectedApps,
            namedCredentials,
            documentMeta,
            cssPath,
            htmlPath,
            flows
        });
    }
    /**
     * Creates a PDF document with the provided HTML content and data, and saves it to a specified file path.
     *
     * @param {Object} doc - An object containing various data needed to generate the PDF document, including org information,
     * SSO settings, standard and custom objects, Apex classes, Apex REST resources, Apex test classes, connected apps,
     * named credentials, document metadata, and file paths for the HTML and CSS content.
     *
     * @returns {Promise<void>} - A Promise that resolves when the PDF document has been created and saved successfully.
     * The Promise will be rejected if there is an error during the PDF creation process.
     */
    private async createPdfDocument(doc){
        const {
            orginfo,
            ssoSettings,
            std_objects,
            cust_objects,
            apexClasses,
            apexRestResource,
            apexTestClasses,
            connectedApps,
            namedCredentials,
            documentMeta,
            cssPath,
            htmlPath,
            flows
        } = doc;
        this.ux.startSpinner('Create pdf document');
        const html = fs.readFileSync(htmlPath, "utf8");
        const css = fs.readFileSync(cssPath, "utf8");
        const document = {
            html: html,
            data: {
                orginfo,
                ssoSettings,
                std_objects,
                cust_objects,
                apexClasses,
                apexRestResource,
                apexTestClasses,
                connectedApps,
                namedCredentials,
                document: documentMeta.documentInfo,
                style: css,
                flows
            },
            path: `./${documentMeta.documentInfo.title ?? 'DXB Technical Design'}.pdf`,
            type: "",
          };
        await pdf.create(document, documentMeta.pdfOption);
        this.ux.stopSpinner(`Done`);
    }
    /**
     * Retrieves Apex classes from the Salesforce org.
     * @returns {Promise<Array>} A Promise that resolves to an array of Apex classes.
    */
    private async getApexClasses(){
        return (await this.query(APEXCLSQUERY))
            .map( (cls:any) => { 
                return {... cls, Body: (cls.Body.length < 100 ? cls.Body : cls.Body.substring(0,100))
            }});
    }
    /**
     * Gets the usage count of each connected app.
     * @param {any[]} apps - The array of connected apps to retrieve usage count for.
     * @returns {Promise<any[]>} An array of objects containing the app and its usage count.
     */
    private async getConnectedAppUsage(apps: any[]): Promise<any[]> {
        const usagePromises = apps.map(async (app) => {
          try {
            const result: any = await this.connection.query(`SELECT COUNT() FROM OauthToken where AppName = '${app.Name}'`);
            return { ...app, usage: result.totalSize };
          } catch (err) {
            return { ...app, usage: 0 };
          }
        });
        return Promise.all(usagePromises);
    }
    private async getFlowDefinitions(): Promise<any[]> {
        const flows = await this.query(FLOWQUERY);
        if (flows){
            const fullNameList = flows.map( (f:any) => { return f.ApiName;});
            const chunkSize = 10
            const chunks = []
            // Split the array into chunks of 10 records
            fullNameList.forEach((name, index) => {
                const chunk = fullNameList.slice(index, index + chunkSize);
                chunks.push(chunk);
            });
            
            return Promise.all(chunks.map(async (c) => {
                try{
                    return await this.toArray(await this.connection.metadata.readSync('Flow', c));
                }catch(err){}
            }));
        }
        return undefined;
    }
    private processFlow(flows){
        return flows.map( (f:any) => {
            return {...f,recordCreateCount: f.recordCreates?.length | 0,recordLookupCount: f.recordLookups?.length | 0, recordUpdateCount: f.recordUpdate?.length | 0}
        });
    }
    private async getFlowDefinitionForSObject(sobjects: any[]): Promise<any[]> {
        const flows = await this.query(AUTOFLOWQUERY.split('{{object_name}}').join(`'${sobjects.join("','")}'`));
        if (flows){
            const fullNameList = flows.map( (f:any) => { return f.ApiName;});
            const chunkSize = 10
            const chunks = []
            // Split the array into chunks of 10 records
            fullNameList.forEach((name, index) => {
                const chunk = fullNameList.slice(index, index + chunkSize);
                chunks.push(chunk);
            });
            
            return Promise.all(chunks.map(async (c) => {
                try{
                    return await this.toArray(await this.connection.metadata.readSync('Flow', c));
                }catch(err){}
            }));
        }
        return undefined;
    }
    /**
     * Fetches the trigger information for a list of sObjects from a pre-fetched list of all triggers.
     * @param {Array} sobjects - List of sObjects to fetch trigger information for.
     * @param {Array} allTriggers - List of all triggers fetched from the org.
     * @returns {Array} - An array of sObjects with trigger information.
     */
    private async getTriggerForSObject(sobjects: any[], allTriggers: any[]): Promise<any[]> {
        // Convert the list of triggers to a map with sObject names as keys
        const triggerMap = allTriggers.reduce((acc, cur) => {
            if (!acc[cur.TableEnumOrId]) {
                acc[cur.TableEnumOrId] = [];
            }
            acc[cur.TableEnumOrId].push(cur);
            return acc;
        }, {});
    
        // Add trigger information to each sObject in the list
        return sobjects.map((sobject) => {
            const triggers = triggerMap[sobject.QualifiedApiName];
            const triggerInfo = triggers
                ? triggers.map((trigger) => {
                    const operations = [];
                    if (trigger.UsageBeforeInsert) operations.push({ name: 'Before Insert' });
                    if (trigger.UsageAfterInsert) operations.push({ name: 'After Insert' });
                    if (trigger.UsageBeforeUpdate) operations.push({ name: 'Before Update' });
                    if (trigger.UsageAfterUpdate) operations.push({ name: 'After Update' });
                    if (trigger.UsageBeforeDelete) operations.push({ name: 'Before Delete' });
                    if (trigger.UsageAfterDelete) operations.push({ name: 'After Delete' });
                    if (trigger.UsageAfterUndelete) operations.push({ name: 'After Undelete' });
                    return { ...trigger, operation: operations };
                })
                : [];
            return { ...sobject, triggers: triggerInfo, hasTriggers: triggers?.length > 0 };
        });
    }  
    /**
     * Fetches the field definition for a list of sObjects in chunks of 10 using the provided SOQL query.
     * @param {Array} sobjects - List of sObject names to fetch field definition for.
     * @returns {Promise<Array>} - A Promise that resolves to an array of field definition objects.
     */
    private async getFieldDefinitionForSObject(sobjects: any[]): Promise<any[]> {
        const chunkSize = 10
        const chunks = []
        // Split the array into chunks of 10 records
        sobjects.forEach((name, index) => {
            const chunk = sobjects.slice(index, index + chunkSize);
            chunks.push(chunk);
        });
        return Promise.all(chunks.map(async (c) => {
            try{
                return await this.query(FIELDQUERY.split('{{object_name}}').join(`'${c.join("','")}'`));
            }catch(err){}
        }));
    }
    /**
     * This method is used to get the sharing rules metadata of an array of fullNames. 
     * It takes in an array of fullNames as a parameter and returns a promise with the metadata.
     * @param {array} fullNames - An array of fullNames 
     * @returns {Promise<Array>} - An array of sharing rules metadata
     */
    private async getSharingRulesMetadata(fullNames) {
      const chunkSize = 5;
      const chunks = [];
    
      // Split the array into chunks of 10 records
      fullNames.forEach((name, index) => {
        const chunk = fullNames.slice(index, index + chunkSize);
        chunks.push(chunk);
      });
      return Promise.all(chunks.map(async (c) => {
        try {
          return this.toArray(await this.connection.metadata.readSync('SharingRules', c))
            .map((sh: any) => {
              if (sh && sh.fullName) {
                let { sharingCriteriaRules, sharingOwnerRules } = sh;
                if (sharingCriteriaRules) {
                  sharingCriteriaRules = this.toArray(sharingCriteriaRules).map((shc: any) => {
                    shc.criteriaItems = this.toArray(shc.criteriaItems);
                    shc.sharedTo = this.formatSharedInfo(this.toArray(shc.sharedTo));
                    return { ...shc };
                  });
                }
                if (sharingOwnerRules) {
                  sharingOwnerRules = this.toArray(sharingOwnerRules).map((sho: any) => {
                    sho.sharedTo = this.formatSharedInfo(this.toArray(sho.sharedTo));
                    sho.sharedFrom = this.formatSharedInfo(this.toArray(sho.sharedFrom));
                    return { ...sho };
                  });
                }
                return { ...sh, sharingOwnerRules, sharingCriteriaRules };
              }
            });
        } catch (err) { }
      }));
    }
    /**
     * Retrieves the SSO setting metadata
     *
     * @returns {Promise<Array>} - An array of SSO setting metadata
     */
    private async getSSOSettingMetadata() {
        const types = [{ type: 'SamlSsoConfig', folder: null }];
        const list = await this.toArray(await this.connection.metadata.list(types, '57.0'));
        const fullNameList = list.map(e => e.fullName);
        return await this.toArray(await this.connection.metadata.readSync('SamlSsoConfig', fullNameList));
    }
    // private async getSettingMetadata(names: string[]){
    //     return await this.connection.metadata.read('CaseSettings', ['CaseSettings']);
    // }
    /**
     * Retrieves custom object metadata from Salesforce for a given list of object api name by using jsforce. 
     * Jsforce limit to max 10 objects per called so the method split by chunk
     * @param {string} type - Type of metadata object
     * @param {array} fullNames - Array of fullNames for the metadata object
     * @returns {Promise} - Returns a promise
    */
    private async getMetadataObject(type, fullNames){
        const chunkSize = 5;
        const chunks = [];
        
        // Split the array into chunks of 10 records
        fullNames.forEach((name, index) => {
          const chunk = fullNames.slice(index, index + chunkSize);
          chunks.push(chunk);
        });
        return Promise.all(chunks.map(async (c) => {
            try{
                return await this.connection.metadata.readSync(type, c);
            }catch(err){}
        }));
    }
    /**
     * Get the object definition of given sobjects with its metadata, sharing rules metadata, and field definition
     * @param {Array} sobjects - Array of sobject types to fetch definition for
     * @param {string} type - Type of the metadata to fetch
     * @param {Array} fullNames - Array of full names for the metadata to fetch
     * @returns {Array} - Array of sobjects with its metadata, sharing rules metadata, field definition, and other related information
    */
    private async getObjectDefinition(sobjects,type, fullNames){
        //get object and related element metadata
        const metadata:any = (await this.getMetadataObject(type, fullNames)).flat();
        const sharingRulesArray:any = (await this.getSharingRulesMetadata(fullNames)).flat();
        const fieldsArray = await this.getFieldDefinitionForSObject(fullNames);
        const flowsArray = await this.getFlowDefinitionForSObject(fullNames);
        let objectFlows:any = new Map();
        if (flowsArray){
            objectFlows = flowsArray.flat().reduce((acc, cur) => {
                if (acc.has(cur.start.object)) {
                  acc.get(cur.start.object).push(cur);
                } else {
                  acc.set(cur.start.object, [cur]);
                }
                return acc;
              }, new Map());
        }
        const objectFields:any = fieldsArray.flat().reduce((acc, cur) => {
            if (acc.has(cur.EntityDefinition.QualifiedApiName)) {
              acc.get(cur.EntityDefinition.QualifiedApiName).push(cur);
            } else {
              acc.set(cur.EntityDefinition.QualifiedApiName, [cur]);
            }
            return acc;
          }, new Map());
        //decorate object with other metadata
        return sobjects.map( o => {
            let objectMeta = metadata.find( e => e && e.fullName && e.fullName === o.QualifiedApiName);
            let sharingRules = sharingRulesArray.find( e => e && e.fullName && e.fullName === o.QualifiedApiName);
            let autoflows = objectFlows.get(o.QualifiedApiName);
            let fields = objectFields.get(o.QualifiedApiName);
            objectMeta.fields = this.toArray(objectMeta.fields);
            objectMeta.fields = objectMeta.fields.map( mf => {
                let f = fields.find( e => mf.fullName === e.QualifiedApiName);
                return {
                    ...f,
                    ...mf,
                    summaryFilterItems: this.toArray(mf.summaryFilterItems)
                };
            });
            objectMeta.hasValidations = !!objectMeta.validationRules;
            if (objectMeta.hasValidations){
                objectMeta.validationRules = this.toArray(objectMeta.validationRules);
            }
            objectMeta.hasRecordTypes = !!objectMeta.recordTypes;
            if(objectMeta.hasRecordTypes){
                objectMeta.recordTypes = this.toArray(objectMeta.recordTypes);
            }
            objectMeta.hasListViews = !!objectMeta.listViews;
            if (objectMeta.hasListViews){
                if (!Array.isArray(objectMeta.listViews)){
                    objectMeta.listViews = [{...objectMeta.listViews}];
                }
                objectMeta.listViews.forEach( lv => {
                    lv.hasFilters = !!lv.filters;
                    if (lv.hasFilters){
                        lv.filters = this.toArray(lv.filters);
                    }
                    lv.hasShareTo = !!lv.sharedTo;
                    if (lv.hasShareTo){
                        lv.sharedTo = this.formatSharedInfo(this.toArray(lv.sharedTo));;
                    }
                });
            }
            const sharingCriteriaRules = sharingRules?.sharingCriteriaRules;
            const sharingOwnerRules = sharingRules?.sharingOwnerRules;
            const hasSharingRules = !!sharingCriteriaRules || !!sharingOwnerRules;
            return {...o,...objectMeta, hasAutoFlows:!!autoflows, autoflows, hasSharingRules, hasOwnerSharingRules: !!sharingOwnerRules, hasCriteriaSharingRules: !!sharingCriteriaRules, sharingCriteriaRules, sharingOwnerRules};
        });
    }
    /**
     * Formats the shared object (sharedTo and sharedFrom)
     * @param {Object} sharedInfo - The object to be formatted
     * @returns {Array} formattedSharedTo - The formatted object
    */
    private formatSharedInfo(sharedInfo) {
      let formattedSharedTo = [];
      sharedInfo.forEach(r => {
        for (let k in r) {
          let value = r[k] ? Array.isArray(r[k]) ? r[k].toString() : r[k] : "";
          formattedSharedTo.push({ label: this.toCapitalCase(k), value });
        }
      });
      return formattedSharedTo;
    }
    /**
     * Converts the first character of a string to uppercase.
     * @param {string} str - The string to be converted. 
     * @returns {string} - The string with the first character in uppercase.
     */
    private toCapitalCase(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    /**
     * Converts an object to an array
     * @param {Object} prop - The object to convert
     * @returns {Array} An array representation of the object
     */
    private toArray(prop) {
        return Array.isArray(prop) ? prop : [{...prop}];
    }
    /**
     * Executes a SOQL query
     * @param {string} soql - The SOQL query to execute
     * @returns {Promise} The records returned from the query
     */
    private async query(soql:string){
        return (await this.connection.query(soql)).records; 
    }
}