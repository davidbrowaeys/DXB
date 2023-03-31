import { SfdxCommand, flags } from '@salesforce/command';
import { Connection } from '@salesforce/core';
import * as path from 'path';
import * as fs from 'fs';
import * as pdf from 'pdf-creator-node';
const ORGQUERY = "SELECT WebToCaseDefaultOrigin, UsesStartDateAsFiscalYearName, UiSkin, TrialExpirationDate, TimeZoneSidKey, SystemModstamp, Street, State, SignupCountryIsoCode, ReceivesInfoEmails, ReceivesAdminInfoEmails, PrimaryContact, PreferencesTransactionSecurityPolicy, PreferencesTerminateOldestSession, PreferencesRequireOpportunityProducts, PreferencesOnlyLLPermUserAllowed, PreferencesLightningLoginEnabled, PreferencesConsentManagementEnabled, PreferencesAutoSelectIndividualOnMerge, PostalCode, Phone, OrganizationType, NumKnowledgeService, NamespacePrefix, Name, MonthlyPageViewsUsed, MonthlyPageViewsEntitlement, Longitude, Latitude, LastModifiedDate, LastModifiedById, LanguageLocaleKey, IsSandbox, IsReadOnly, InstanceName, Id, GeocodeAccuracy, FiscalYearStartMonth, Fax, Division, DefaultPricebookAccess, DefaultOpportunityAccess, DefaultLocaleSidKey, DefaultLeadAccess, DefaultContactAccess, DefaultCaseAccess, DefaultCampaignAccess, DefaultCalendarAccess, DefaultAccountAccess, CreatedDate, CreatedById, Country, ComplianceBccEmail, City, Address FROM Organization";
const STDQUERY = "SELECT Id, DurableId, LastModifiedDate, LastModifiedById, QualifiedApiName, NamespacePrefix, DeveloperName, MasterLabel, Label, PluralLabel, DefaultCompactLayoutId, IsCustomizable, IsApexTriggerable, IsWorkflowEnabled, IsProcessEnabled, IsCompactLayoutable, DeploymentStatus, KeyPrefix, IsCustomSetting, IsDeprecatedAndHidden, IsReplicateable, IsRetrieveable, IsSearchLayoutable, IsSearchable, IsTriggerable, IsIdEnabled, IsEverCreatable, IsEverUpdatable, IsEverDeletable, IsFeedEnabled, IsQueryable, IsMruEnabled, DetailUrl, EditUrl, NewUrl, EditDefinitionUrl, HelpSettingPageName, HelpSettingPageUrl, RunningUserEntityAccessId, PublisherId, IsLayoutable, RecordTypesSupported, InternalSharingModel, ExternalSharingModel, HasSubtypes, IsSubtype, IsAutoActivityCaptureEnabled, IsInterface, ImplementsInterfaces, ImplementedBy, ExtendsInterfaces, ExtendedBy, DefaultImplementation FROM EntityDefinition WHERE QualifiedApiName IN ('{{stdobject}}') ORDER BY NamespacePrefix, QualifiedApiName LIMIT 2000";
const CUSTOMQUERY = "SELECT Id, DurableId, LastModifiedDate, LastModifiedById, QualifiedApiName, NamespacePrefix, DeveloperName, MasterLabel, Label, PluralLabel, DefaultCompactLayoutId, IsCustomizable, IsApexTriggerable, IsWorkflowEnabled, IsProcessEnabled, IsCompactLayoutable, DeploymentStatus, KeyPrefix, IsCustomSetting, IsDeprecatedAndHidden, IsReplicateable, IsRetrieveable, IsSearchLayoutable, IsSearchable, IsTriggerable, IsIdEnabled, IsEverCreatable, IsEverUpdatable, IsEverDeletable, IsFeedEnabled, IsQueryable, IsMruEnabled, DetailUrl, EditUrl, NewUrl, EditDefinitionUrl, HelpSettingPageName, HelpSettingPageUrl, RunningUserEntityAccessId, PublisherId, IsLayoutable, RecordTypesSupported, InternalSharingModel, ExternalSharingModel, HasSubtypes, IsSubtype, IsAutoActivityCaptureEnabled, IsInterface, ImplementsInterfaces, ImplementedBy, ExtendsInterfaces, ExtendedBy, DefaultImplementation FROM EntityDefinition WHERE DeploymentStatus != null AND IsCustomizable = TRUE ORDER BY NamespacePrefix, QualifiedApiName";
const FIELDQUERY = "SELECT Id, EntityDefinitionId, EntityDefinition.QualifiedApiName, DurableId, QualifiedApiName, NamespacePrefix, DeveloperName, MasterLabel, Label, Length, DataType, ServiceDataTypeId, ValueTypeId, ExtraTypeInfo, IsCalculated, IsHighScaleNumber, IsHtmlFormatted, IsNameField, IsNillable, IsWorkflowFilterable, IsCompactLayoutable, Precision, Scale, IsFieldHistoryTracked, IsIndexed, IsApiFilterable, IsApiSortable, IsListFilterable, IsListSortable, IsApiGroupable, IsListVisible, ControllingFieldDefinitionId, LastModifiedDate, LastModifiedById, PublisherId, RunningUserFieldAccessId, RelationshipName, ReferenceTo, ReferenceTargetField, IsCompound, IsSearchPrefilterable, IsPolymorphicForeignKey, IsAiPredictionField, BusinessOwnerId, BusinessStatus, SecurityClassification, ComplianceGroup, Description FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName IN ({{object_name}}) ORDER BY NamespacePrefix, QualifiedApiName";
const APEXCLSQUERY = "SELECT Id, Name, ApiVersion, Status, Body, IsValid, LengthWithoutComments FROM ApexClass WHERE NamespacePrefix = null ORDER BY Name";
const APEXTRGQUERY = "SELECT UsageBeforeInsert, UsageAfterInsert, UsageBeforeUpdate, UsageAfterUpdate, UsageBeforeDelete, UsageAfterDelete, UsageIsBulk, UsageAfterUndelete, ApiVersion, Status, TableEnumOrId, Name, Id, Body FROM ApexTrigger where NamespacePrefix = null"
const NAMEDCREDQUERY = "SELECT Id, DeveloperName, Endpoint, PrincipalType, Language, MasterLabel, AuthTokenEndpointUrl, JwtIssuer FROM NamedCredential";
const CONNECTEDAPPQUERY = "SELECT Id, Name, MobileStartUrl, RefreshTokenValidityPeriod, UvidTimeout, OptionsAllowAdminApprovedUsersOnly, OptionsRefreshTokenValidityMetric, MobileSessionTimeout, OptionsCodeCredentialGuestEnabled, OptionsFullContentPushNotifications, OptionsAllowExpiredUvidJWT, OptionsIsInternal, OptionsHasSessionLevelPolicy, PinLength, StartUrl FROM ConnectedApplication";
export default class SchemaDocGen extends SfdxCommand {

    public static description = 'This command generate a as-build technical design pdf document by pulling metadata such as cusotm object, classes etc directly from an org.';

    public static examples = [
        'sfdx dxb:schema:generate:doc -u tlcuat -c config/documentinfo.json'
    ];

    public static args = [{ name: 'file' }];

    protected static flagsConfig = {
        pdfconfig:flags.string({
            char: 'c',
            description: 'File path of pdf document as json',
            required:true
        }),
        stylesheet: flags.string({
            char: 's',
            description: 'File path of stylesheet, default(boostrap)'
        }),
        htmltemplate: flags.string({
            char: 't',
            description: 'File path of html template, default(dxb template)'
        }),
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;

    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;

    protected connection:Connection;

    public async run() {
        const {pdfconfig, stylesheet, htmltemplate} = this.flags;
        this.connection = this.org.getConnection();
        //validate filess
        console.log(__dirname);
        let htmlPath = htmltemplate? htmltemplate : path.join(__dirname, '../../../../../src/lib/schema-template.html');
        let cssPath = stylesheet? stylesheet: path.join(__dirname, '../../../../../src/lib/bootstrap.min.css');
        if (!fs.existsSync(htmlPath)){
            throw new Error(`HTML Template not found: ${htmlPath}`);
        }
        if (!fs.existsSync(cssPath)){
            throw new Error(`Stylesheet file not found: ${cssPath}`);
        }
        if (!fs.existsSync(pdfconfig)){
            throw new Error(`PDF Metadata Config Json file not found: ${pdfconfig}`);
        }
        const documentMeta:any = JSON.parse(fs.readFileSync(pdfconfig, "utf8"));
        if(!documentMeta.metadata || !documentMeta.metadata.stdobjects || !Array.isArray(documentMeta.metadata.stdobjects)){
            throw new Error(`You must define list of standard objects as follow "metadata": { stdobjects: ["Account","Contact"]} in your pdf document:${pdfconfig}`);
        }
        //const settings = await this.getSettingMetadata(['Case']);
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

        //retrieve apex classes and triggers
        this.ux.startSpinner('Retrieve apex classes');
        let apexClasses = await (await this.query(APEXCLSQUERY)).map( (cls:any) => { return {...cls,Body: (cls.Body.length < 100 ? cls.Body : cls.Body.substring(0,100))}});
        let apexRestResource = apexClasses.filter( (a:any) => a.Body.includes('@RestResource'))
            .map( (a:any) => { 
                const regex = /urlMapping=['"]([^'"]+)['"]/;
                const match = a.Body.match(regex);
                const urlMappingValue = match ? match[1] : undefined;
                return {...a,urlMappingValue};
        });
        apexClasses = apexClasses.filter( (a:any) => !a.Body.includes('@RestResource'));
        let apexTestClasses = apexClasses.filter( (a:any) => a.Body.toLowerCase().includes('@istest'));
        apexClasses = apexClasses.filter( (a:any) => !a.Body.toLowerCase().includes('@isTest'));
        this.ux.stopSpinner(`${apexClasses.length} found!`);
        this.ux.startSpinner('Retrieve apex triggers');
        let triggers = await this.query(APEXTRGQUERY);//.map( (cls:any) => { return {...cls,Body: (cls.Body.length < 100 ? cls.Body : cls.Body.substring(0,100))}});
        this.ux.stopSpinner(`${triggers.length} found!`);
        std_objects = await this.getTriggerForSObject(std_objects,triggers);
        cust_objects = await this.getTriggerForSObject(cust_objects,triggers);

        //retrieve integration settings
        this.ux.startSpinner('Retrieve name credentials');
        let namedCredentials = await this.query(NAMEDCREDQUERY);
        this.ux.stopSpinner(`${namedCredentials.length} found!`);
        this.ux.startSpinner('Retrieve connected apps');
        let connectedApps:any = await this.getConnectedAppUsage( await this.query(CONNECTEDAPPQUERY) );
        this.ux.stopSpinner(`${connectedApps.length} found!`);
        
        
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
                style: css
            },
            path: "./sample_pdfoutput.pdf",
            type: "",
          };
        await pdf.create(document, documentMeta.pdfOption);
        this.ux.stopSpinner(`Done`);
    }

    private async getConnectedAppUsage(apps:any[]){
        return Promise.all(apps.map(async (c) => {
            let usage = 0;
            try{    //this object doesn't allow to aggregate by UserId field :-(
                const result:any =await this.connection.query(`SELECT COUNT() FROM OauthToken where AppName = '${c.Name}'`);
                usage = result.totalSize;
            }catch(err){}
            return {...c, usage};
        }));
    }

    private async getTriggerForSObject(sobjects: any[],allTriggers: any[]){
        const triggerPerObject:any = allTriggers.reduce((acc:any, cur:any) => {
            if (acc.has(cur.TableEnumOrId)) {
            acc.get(cur.TableEnumOrId).push(cur);
            } else {
            acc.set(cur.TableEnumOrId, [cur]);
            }
            return acc;
        }, new Map());
        return sobjects.map( (o:any) => {
            let triggers = triggerPerObject.get(o.QualifiedApiName);
            if (triggers){
                triggers = triggers.map( (t) => {
                    let operation = [];
                    if (t.UsageBeforeInsert) operation.push({name:'Before Insert'});
                    if (t.UsageAfterInsert) operation.push({name:'After Insert'});
                    if (t.UsageBeforeUpdate) operation.push({name:'Before Update'});
                    if (t.UsageAfterUpdate) operation.push({name:'After Update'});
                    if (t.UsageBeforeDelete) operation.push({name:'Before Delete'});
                    if (t.UsageAfterDelete) operation.push({name:'After Delete'});
                    if (t.UsageAfterUndelete) operation.push({name:'After Undelete'});
                    if (t.UsageAfterInsert) operation.push({name:'After Insert'});
                    return {...t,operation};
                });
            }
            return {...o,triggers,hasTriggers: !!triggers}
        });
    }

    private async getFieldDefinitionForSObject(sobjects: any[]): Promise<any[]> {
        const chunkSize = 10
        const chunks = []

        // Split the array into chunks of 10 records
        for (let i = 0; i < sobjects.length; i += chunkSize) {
            const chunk = sobjects.slice(i, i + chunkSize)
            chunks.push(chunk)
        }
        return Promise.all(chunks.map(async (c) => {
            try{
                return await this.query(FIELDQUERY.split('{{object_name}}').join(`'${c.join("','")}'`));
            }catch(err){}
        }));
    }
    private async getSharingRulesMetadata(fullNames){
        const chunkSize = 5
        const chunks = []

        // Split the array into chunks of chunkSize records (limited to 10 in jsforce)
        for (let i = 0; i < fullNames.length; i += chunkSize) {
            const chunk = fullNames.slice(i, i + chunkSize)
            chunks.push(chunk)
        }
        return Promise.all(chunks.map(async (c) => {
            try{
                return this.toArray(await this.connection.metadata.readSync('SharingRules', c))
                    .map( (sh:any) => {
                        if (sh && sh.fullName){
                            let {sharingCriteriaRules, sharingOwnerRules} = sh;
                            if(sharingCriteriaRules){
                                sharingCriteriaRules = this.toArray(sharingCriteriaRules).map( (shc:any) =>{
                                    shc.criteriaItems = this.toArray(shc.criteriaItems);
                                    shc.sharedTo = this.toArray(shc.sharedTo);
                                    let formattedSharedTo = [];
                                    shc.sharedTo.forEach(r => {
                                        for (let k in r){
                                            let value = r[k] ? Array.isArray(r[k]) ? r[k].toString() : r[k] : "";
                                            formattedSharedTo.push({label:this.toCapitalCase(k), value});
                                        }
                                    });
                                    shc.sharedTo = formattedSharedTo;
                                    return {...shc};
                                });
                            }
                            if(sharingOwnerRules){
                                sharingOwnerRules = this.toArray(sharingOwnerRules).map( (sho:any) =>{
                                    //shared to
                                    let formattedSharedTo = [];
                                    sho.sharedTo = this.toArray(sho.sharedTo);
                                    sho.sharedTo.forEach(r => {
                                        for (let k in r){
                                            let value = r[k] ? Array.isArray(r[k]) ? r[k].toString() : r[k] : "";
                                            formattedSharedTo.push({label:this.toCapitalCase(k), value});
                                        }
                                    });
                                    sho.sharedTo = formattedSharedTo;
                                    //shared from
                                    let formattedSharedFrom = [];
                                    sho.sharedFrom = this.toArray(sho.sharedFrom);
                                    sho.sharedFrom.forEach(r => {
                                        for (let k in r){
                                            let value = r[k] ? Array.isArray(r[k]) ? r[k].toString() : r[k] : "";
                                            formattedSharedFrom.push({label:this.toCapitalCase(k), value});
                                        }
                                    });
                                    sho.sharedFrom = formattedSharedFrom;
                                    return {...sho};
                                });
                            }
                            return {...sh, sharingOwnerRules, sharingCriteriaRules};
                        }
                    });
            }catch(err){}
        }));
        // var types = [{type: 'SharingRules', folder: null}];
        // const list = this.toArray(await this.connection.metadata.list(types, '57.0'));
        // console.log(list);
        // return this.toArray(await this.connection.metadata.readSync('SharingRules', fullNames));
    }
    private async getSSOSettingMetadata(){
        var types = [{type: 'SamlSsoConfig', folder: null}];
        const list = this.toArray(await this.connection.metadata.list(types, '57.0'));
        ///////////
        return  this.toArray(await this.connection.metadata.readSync('SamlSsoConfig', list.map( e => e.fullName)));
    }
    // private async getSettingMetadata(names: string[]){
    //     return await this.connection.metadata.read('CaseSettings', ['CaseSettings']);
    // }
    private async getMetadataObject(type, fullNames){
        const chunkSize = 5
        const chunks = []

        // Split the array into chunks of 10 records
        for (let i = 0; i < fullNames.length; i += chunkSize) {
            const chunk = fullNames.slice(i, i + chunkSize)
            chunks.push(chunk)
        }
        return Promise.all(chunks.map(async (c) => {
            try{
                return await this.connection.metadata.readSync(type, c);
            }catch(err){}
        }));
    }

    private async getObjectDefinition(sobjects,type, fullNames){
        // const metadata:any = await this.connection.metadata.readSync(type, fullNames);
        const metadata:any = (await this.getMetadataObject(type, fullNames)).flat();
        const sharingRulesArray:any = (await this.getSharingRulesMetadata(fullNames)).flat();
        const fieldsArray = await this.getFieldDefinitionForSObject(fullNames);
        const objectFields:any = fieldsArray.flat().reduce((acc, cur) => {
            if (acc.has(cur.EntityDefinition.QualifiedApiName)) {
              acc.get(cur.EntityDefinition.QualifiedApiName).push(cur);
            } else {
              acc.set(cur.EntityDefinition.QualifiedApiName, [cur]);
            }
            return acc;
          }, new Map());
        return sobjects.map( o => {
            let objectMeta = metadata.find( e => e && e.fullName && e.fullName === o.QualifiedApiName);
            let sharingRules = sharingRulesArray.find( e => e && e.fullName && e.fullName === o.QualifiedApiName);
            let fields = objectFields.get(o.QualifiedApiName);
            objectMeta.fields = this.toArray(objectMeta.fields);
            objectMeta.fields = objectMeta.fields.map( mf => {
                let f = fields.find( e => mf.fullName === e.QualifiedApiName);
                return {...mf,...f};
            });
            objectMeta.hasValidations = !!objectMeta.validationRules;
            if (objectMeta.hasValidations){
                if (!Array.isArray(objectMeta.validationRules)){
                    objectMeta.validationRules = [{...objectMeta.validationRules}];
                }
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
                        lv.sharedTo = this.toArray(lv.sharedTo);
                        let formattedShareTo = [];
                        lv.sharedTo.forEach(sh => {
                            for (let k in sh){
                                let value = sh[k] ? Array.isArray(sh[k]) ? sh[k].toString() : sh[k] : "";
                                formattedShareTo.push({label:this.toCapitalCase(k), value});
                            }
                        });
                        lv.sharedTo = formattedShareTo;
                    }
                });
            }
            const sharingCriteriaRules = sharingRules?.sharingCriteriaRules;
            const sharingOwnerRules = sharingRules?.sharingOwnerRules;
            const hasSharingRules = !!sharingCriteriaRules || !!sharingOwnerRules;
            return {...o,...objectMeta, hasSharingRules, hasOwnerSharingRules: !!sharingOwnerRules, hasCriteriaSharingRules: !!sharingCriteriaRules, sharingCriteriaRules, sharingOwnerRules};
        });
    }

    private toCapitalCase(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    private toArray(prop){
        if (!Array.isArray(prop)){
            prop = [{...prop}];
        }
        return prop;
    }

    private async query(soql:string){
        return (await this.connection.query(soql)).records; 
    }
}