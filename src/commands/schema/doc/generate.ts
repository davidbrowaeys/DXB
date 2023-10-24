import * as path from 'path';
import * as fs from 'fs-extra';
import * as mime from 'mime';
import { Record } from 'jsforce';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Connection, Messages } from '@salesforce/core';
import * as Handlebars from 'handlebars';
// import { NodeHtmlMarkdown } from 'node-html-markdown';
// import * as htmlDocx from "html-docx-js";
import { asBlob } from 'html-docx-js-typescript';
import * as xml2js from 'xml2js';
import {
  CustomObject,
  Flow,
  SharingCriteriaRule,
  SharingOwnerRule,
  SharingRules,
  ListView,
  SamlSsoConfig,
  MetadataDefinition,
  SharedTo,
  MetadataType,
} from 'jsforce/lib/api/metadata';
import { FileProperties } from '@salesforce/source-deploy-retrieve';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require('pdf-creator-node');

// constants
const ORGQUERY =
  'SELECT WebToCaseDefaultOrigin, UsesStartDateAsFiscalYearName, UiSkin, TrialExpirationDate, TimeZoneSidKey, SystemModstamp, Street, State, SignupCountryIsoCode, ReceivesInfoEmails, ReceivesAdminInfoEmails, PrimaryContact, PreferencesTransactionSecurityPolicy, PreferencesRequireOpportunityProducts, PreferencesOnlyLLPermUserAllowed, PreferencesLightningLoginEnabled, PreferencesConsentManagementEnabled, PreferencesAutoSelectIndividualOnMerge, PostalCode, Phone, OrganizationType, NumKnowledgeService, NamespacePrefix, Name, MonthlyPageViewsUsed, MonthlyPageViewsEntitlement, Longitude, Latitude, LastModifiedDate, LastModifiedById, LanguageLocaleKey, IsSandbox, IsReadOnly, InstanceName, Id, GeocodeAccuracy, FiscalYearStartMonth, Fax, Division, DefaultPricebookAccess, DefaultOpportunityAccess, DefaultLocaleSidKey, DefaultLeadAccess, DefaultContactAccess, DefaultCaseAccess, DefaultCampaignAccess, DefaultCalendarAccess, DefaultAccountAccess, CreatedDate, CreatedById, Country, ComplianceBccEmail, City, Address FROM Organization';
const STDQUERY =
  "SELECT Id, DurableId, LastModifiedDate, LastModifiedById, QualifiedApiName, NamespacePrefix, DeveloperName, MasterLabel, Label, PluralLabel, DefaultCompactLayoutId, IsCustomizable, IsApexTriggerable, IsWorkflowEnabled, IsProcessEnabled, IsCompactLayoutable, DeploymentStatus, KeyPrefix, IsCustomSetting, IsDeprecatedAndHidden, IsReplicateable, IsRetrieveable, IsSearchLayoutable, IsSearchable, IsTriggerable, IsIdEnabled, IsEverCreatable, IsEverUpdatable, IsEverDeletable, IsFeedEnabled, IsQueryable, IsMruEnabled, DetailUrl, EditUrl, NewUrl, EditDefinitionUrl, HelpSettingPageName, HelpSettingPageUrl, RunningUserEntityAccessId, PublisherId, IsLayoutable, RecordTypesSupported, InternalSharingModel, ExternalSharingModel, HasSubtypes, IsSubtype, IsAutoActivityCaptureEnabled, IsInterface, ImplementsInterfaces, ImplementedBy, ExtendsInterfaces, ExtendedBy, DefaultImplementation FROM EntityDefinition WHERE QualifiedApiName IN ('{{stdobject}}') ORDER BY NamespacePrefix, QualifiedApiName LIMIT 2000";
const CUSTOMQUERY =
  'SELECT Id, DurableId, LastModifiedDate, LastModifiedById, QualifiedApiName, NamespacePrefix, DeveloperName, MasterLabel, Label, PluralLabel, DefaultCompactLayoutId, IsCustomizable, IsApexTriggerable, IsWorkflowEnabled, IsProcessEnabled, IsCompactLayoutable, DeploymentStatus, KeyPrefix, IsCustomSetting, IsDeprecatedAndHidden, IsReplicateable, IsRetrieveable, IsSearchLayoutable, IsSearchable, IsTriggerable, IsIdEnabled, IsEverCreatable, IsEverUpdatable, IsEverDeletable, IsFeedEnabled, IsQueryable, IsMruEnabled, DetailUrl, EditUrl, NewUrl, EditDefinitionUrl, HelpSettingPageName, HelpSettingPageUrl, RunningUserEntityAccessId, PublisherId, IsLayoutable, RecordTypesSupported, InternalSharingModel, ExternalSharingModel, HasSubtypes, IsSubtype, IsAutoActivityCaptureEnabled, IsInterface, ImplementsInterfaces, ImplementedBy, ExtendsInterfaces, ExtendedBy, DefaultImplementation FROM EntityDefinition WHERE DeploymentStatus != null AND IsCustomizable = TRUE ORDER BY NamespacePrefix, QualifiedApiName';
const FIELDQUERY =
  'SELECT Id, EntityDefinitionId, EntityDefinition.QualifiedApiName, DurableId, QualifiedApiName, NamespacePrefix, DeveloperName, MasterLabel, Label, Length, DataType, ServiceDataTypeId, ValueTypeId, ExtraTypeInfo, IsCalculated, IsHighScaleNumber, IsHtmlFormatted, IsNameField, IsNillable, IsWorkflowFilterable, IsCompactLayoutable, Precision, Scale, IsFieldHistoryTracked, IsIndexed, IsApiFilterable, IsApiSortable, IsListFilterable, IsListSortable, IsApiGroupable, IsListVisible, ControllingFieldDefinitionId, LastModifiedDate, LastModifiedById, PublisherId, RunningUserFieldAccessId, RelationshipName, ReferenceTo, ReferenceTargetField, IsCompound, IsSearchPrefilterable, IsPolymorphicForeignKey, IsAiPredictionField, BusinessOwnerId, BusinessStatus, SecurityClassification, ComplianceGroup, Description FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName IN ({{object_name}}) ORDER BY NamespacePrefix, QualifiedApiName';
const AUTOFLOWQUERY =
  "SELECT Id, ApiName, Label, Description, ProcessType, TriggerType, TriggerOrder, Environments, Builder, ManageableState, RecordTriggerType, TriggerObjectOrEventLabel, TriggerObjectOrEventId, IsActive, ActiveVersionId, OverriddenFlowId, VersionNumber FROM FlowDefinitionView WHERE ProcessType = 'AutoLaunchedFlow' AND Builder = 'Flow Builder' AND ManageableState = 'unmanaged' AND TriggerObjectOrEventId IN ({{object_name}}) ORDER BY Label";
const FLOWQUERY =
  "SELECT Id, ApiName, Label, Description, ProcessType, TriggerType, TriggerOrder, Environments, Builder, ManageableState, RecordTriggerType, TriggerObjectOrEventLabel, TriggerObjectOrEventId, IsActive, ActiveVersionId, OverriddenFlowId, VersionNumber FROM FlowDefinitionView WHERE Builder = 'Flow Builder' AND ManageableState = 'unmanaged' AND TriggerObjectOrEventId = null ORDER BY Label";
const APEXCLSQUERY =
  'SELECT Id, Name, ApiVersion, Status, Body, IsValid, LengthWithoutComments FROM ApexClass WHERE NamespacePrefix = null ORDER BY Name';
const APEXTRGQUERY =
  'SELECT UsageBeforeInsert, UsageAfterInsert, UsageBeforeUpdate, UsageAfterUpdate, UsageBeforeDelete, UsageAfterDelete, UsageIsBulk, UsageAfterUndelete, ApiVersion, Status, TableEnumOrId, Name, Id, Body FROM ApexTrigger where NamespacePrefix = null';
const NAMEDCREDQUERY =
  'SELECT Id, DeveloperName, Endpoint, PrincipalType, Language, MasterLabel, AuthTokenEndpointUrl, JwtIssuer FROM NamedCredential';
const CONNECTEDAPPQUERY =
  'SELECT Id, Name, MobileStartUrl, RefreshTokenValidityPeriod, OptionsAllowAdminApprovedUsersOnly, OptionsRefreshTokenValidityMetric, MobileSessionTimeout, OptionsCodeCredentialGuestEnabled, OptionsFullContentPushNotifications, OptionsIsInternal, OptionsHasSessionLevelPolicy, PinLength, StartUrl FROM ConnectedApplication';
const AURAQUERY =
  'SELECT Id, Language, MasterLabel, ApiVersion, Description, IsDeleted, DeveloperName, NamespacePrefix FROM AuraDefinitionBundle WHERE NamespacePrefix = null ORDER BY MasterLabel';

const getHelper = (executeFn: boolean, options: Handlebars.HelperOptions, it: any): string =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  executeFn ? options.fn(it) : options.inverse(it);

Handlebars.registerHelper('ifCond', (v1: any, operator: string, v2: any, options: Handlebars.HelperOptions) => {
  switch (operator) {
    case '==':
      // eslint-disable-next-line eqeqeq
      return getHelper(v1 == v2, options, this);
    case '===':
      return getHelper(v1 === v2, options, this);
    case '!=':
      // eslint-disable-next-line eqeqeq
      return getHelper(v1 != v2, options, this);
    case '!==':
      return getHelper(v1 !== v2, options, this);
    case '<':
      return getHelper(v1 < v2, options, this);
    case '<=':
      return getHelper(v1 <= v2, options, this);
    case '>':
      return getHelper(v1 > v2, options, this);
    case '>=':
      return getHelper(v1 >= v2, options, this);
    case '&&':
      return getHelper(v1 && v2, options, this);
    case '||':
      return getHelper(v1 || v2, options, this);
    default:
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return options.inverse(this);
  }
});
type FlowDestruct = Flow & {
  recordCreateCount: number;
  recordLookupCount: number;
  recordUpdateCount: number;
};
type ApexClassDestruct = Record & {
  Body: string;
};
type SharingRulesMetadata = {
  sharingOwnerRules: SharingOwnerRule[];
  sharingCriteriaRules: SharingCriteriaRule[];
} & SharingRules;
type ManifestComponent = {
  [key: string]: string[];
};
type ListViewComponent = ListView & {
  hasFilters?: boolean;
  hasShareTo?: boolean;
};
interface CustomObjectComponent extends CustomObject {
  hasValidations?: boolean;
  hasListViews?: boolean;
  hasRecordTypes?: boolean;
  listViews: ListViewComponent[];
}
interface ObjectDefinition extends Record, CustomObjectComponent {
  hasAutoFlows?: boolean;
  autoflows?: Flow[] | undefined;
  hasSharingRules?: boolean;
  hasOwnerSharingRules?: boolean;
  hasCriteriaSharingRules?: boolean;
  sharingCriteriaRules?: SharingCriteriaRule[];
  sharingOwnerRules?: SharingOwnerRule[];
}
type ApexRestResource = ApexClassDestruct & {
  urlMappingValue: string | undefined;
};
type ConnectedAppDestruct = Record & {
  usage: number;
};
type Diagram = {
  standard: { [key: string]: any; path: string; src: string };
  custom: { [key: string]: any; path: string; src: string };
};
interface TriggerDescruct extends ObjectDefinition {
  hasTriggers: boolean;
  triggerInfo?: Array<{
    operation: Array<{
      name: string;
    }>;
    Id?: string | undefined;
    attributes?:
      | {
          [prop: string]: any;
          type: string;
          url: string;
        }
      | undefined;
  }>;
}
type DocumentDefinition = {
  format: string;
  orginfo: ObjectDefinition[];
  ssoSettings: SamlSsoConfig[];
  standardObjects: ObjectDefinition[];
  customObjects: ObjectDefinition[];
  apexClasses: ApexClassDestruct[];
  apexRestResource?: ApexRestResource[];
  apexTestClasses: ApexClassDestruct[];
  connectedApps?: ConnectedAppDestruct[];
  namedCredentials: ObjectDefinition[];
  documentMeta: any;
  cssPath: string;
  pdfPath: string;
  htmlPath: string;
  flows: FlowDestruct[];
};
type SchemaDocGenerateResult = {
  success: boolean;
};
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'schema.doc.generate');

export default class SchemaDocGenerate extends SfCommand<SchemaDocGenerateResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'pdf-config': Flags.string({
      char: 'c',
      summary: messages.getMessage('flags.pdf-config.summary'),
      required: true,
    }),
    stylesheet: Flags.string({
      char: 's',
      summary: messages.getMessage('flags.stylesheet.summary'),
    }),
    'html-template': Flags.string({
      char: 't',
      summary: messages.getMessage('flags.html-template.summary'),
    }),
    manifest: Flags.file({
      char: 'x',
      summary: messages.getMessage('flags.manifest.summary'),
      exists: true,
    }),
    format: Flags.string({
      char: 'r',
      summary: messages.getMessage('flags.format.summary'),
      default: 'pdf',
    }),
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  public static readonly requiresProject = true;

  protected connection!: Connection | undefined;
  protected packageCmps: ManifestComponent | undefined;

  // eslint-disable-next-line complexity
  public async run(): Promise<SchemaDocGenerateResult> {
    const { flags } = await this.parse(SchemaDocGenerate);
    const htmltemplate = flags['html-template'];
    const pdfconfig = flags['pdf-config'];
    const manifest = flags.manifest;
    const format = flags.format;
    // Ensure required files exist
    const pdfPath = htmltemplate ?? path.join(__dirname, '../../../../lib/utils/schema-template.html');
    const htmlPath = htmltemplate ?? path.join(__dirname, '../../../../lib/utils/schema-template-html.html');
    const cssPath = flags.stylesheet ?? path.join(__dirname, '../../../../lib/utils/bootstrap.min.css');
    if (!fs.existsSync(htmlPath)) throw messages.createError('error.noHTMLTemplate', [htmlPath]);
    if (!fs.existsSync(cssPath)) throw messages.createError('error.noStylesheetTemplate', [cssPath]);
    if (!fs.existsSync(pdfconfig)) throw messages.createError('error.noPDFConfig', [pdfconfig]);
    // Parse PDF metadata configuration
    const documentMeta = JSON.parse(fs.readFileSync(pdfconfig, { encoding: 'utf8' }));
    if (manifest) {
      await this.getComponentsFromManifest(manifest);
    }
    // Connect to org
    this.connection = flags['target-org']?.getConnection();
    // retrieve objects informatin
    this.spinner.start(messages.getMessage('spinner.start.retrieveInfo'));
    const orginfo = await this.query(ORGQUERY);
    const ssoSettings = await this.getSSOSettingMetadata((await flags['target-org']?.retrieveMaxApiVersion()) ?? '');
    this.spinner.stop(messages.getMessage('spinner.stop.done'));
    this.spinner.start(messages.getMessage('spinner.start.retrieveStandard'));
    let standardObjects: ObjectDefinition[] = [];
    if (this.packageCmps?.CustomObject && !this.packageCmps.CustomObject.includes('*')) {
      const stdObjectNames = this.packageCmps.CustomObject.filter((o: any) => !o.endsWith('__c'));
      if (stdObjectNames) {
        standardObjects = await this.query(STDQUERY.split('{{stdobject}}').join(stdObjectNames.join("','")));
      }
    } else {
      if (!documentMeta.metadata?.stdobjects || !Array.isArray(documentMeta.metadata.stdobjects)) {
        throw messages.createError('error.metadata.incorrectStandard', [pdfconfig]);
      }
      standardObjects = await this.query(
        STDQUERY.split('{{stdobject}}').join(documentMeta.metadata.stdobjects.join("','"))
      );
    }
    this.spinner.stop(messages.getMessage('spinner.stop.found', [standardObjects.length]));
    this.spinner.start(messages.getMessage('spinner.start.retrieveStandardMetadata'));
    standardObjects = await this.getObjectDefinition(standardObjects, 'CustomObject', documentMeta.metadata.stdobjects);
    standardObjects = standardObjects.filter((sobject) => !!sobject);
    this.spinner.stop(messages.getMessage('spinner.stop.done'));
    this.spinner.start(messages.getMessage('spinner.start.retrieveCustom'));
    let customObjects = await this.query(CUSTOMQUERY);
    customObjects = customObjects.filter((e: ObjectDefinition) => !e.NamespacePrefix);
    if (customObjects && this.packageCmps?.CustomObject && !this.packageCmps.CustomObject.includes('*')) {
      customObjects = customObjects.filter((e: ObjectDefinition) =>
        this.packageCmps?.CustomObject.includes(e.QualifiedApiName)
      );
    }
    this.spinner.stop(messages.getMessage('spinner.stop.found', [customObjects.length]));
    this.spinner.start(messages.getMessage('spinner.start.retrieveCustomMetadata'));
    customObjects = await this.getObjectDefinition(
      customObjects,
      'CustomObject',
      customObjects.map((e: ObjectDefinition) => e.QualifiedApiName as string)
    );
    customObjects = customObjects.filter((sobject) => !!sobject);
    this.spinner.stop(messages.getMessage('spinner.stop.done'));

    this.spinner.start(messages.getMessage('spinner.start.retrieveFlow'));
    let flows: FlowDestruct[] = this.processFlow((await this.getFlowDefinitions()).flat());
    if (flows && this.packageCmps?.Flow) {
      flows = flows.filter((f: FlowDestruct) => this.packageCmps?.Flow.includes(f.fullName ?? ''));
    }
    this.spinner.stop(messages.getMessage('spinner.stop.found', [flows.length]));

    // Retrieve Apex classes, triggers, and REST resources
    this.spinner.start(messages.getMessage('spinner.start.retrieveApex'));
    let apexClasses = await this.getApexClasses();
    if (apexClasses && this.packageCmps?.ApexClass && !this.packageCmps.ApexClass.includes('*')) {
      apexClasses = apexClasses.filter((e: ApexClassDestruct) => this.packageCmps?.ApexClass.includes(e.Name));
    }
    const apexTestClasses = apexClasses.filter((cls) => cls.Body.toLowerCase().includes('@istest'));
    apexClasses = apexClasses.filter((cls) => !cls.Body.toLowerCase().includes('@istest'));
    let apexTriggers = await this.query(APEXTRGQUERY);
    if (apexTriggers && this.packageCmps?.ApexTrigger && !this.packageCmps.ApexTrigger.includes('*')) {
      apexTriggers = apexTriggers.filter((e: ObjectDefinition) => this.packageCmps?.ApexTrigger.includes(e.Name));
    }
    standardObjects = this.getTriggerForSObject(standardObjects, apexTriggers);
    customObjects = this.getTriggerForSObject(customObjects, apexTriggers);
    const apexRestResource: ApexRestResource[] | undefined = !apexClasses
      ? undefined
      : apexClasses
          ?.filter((cls) => cls.Body.includes('@RestResource'))
          .map((cls) => {
            const urlMappingValue = cls.Body.match(/urlMapping=['"]([^'"]+)['"]/)?.[1];
            return { ...cls, urlMappingValue };
          })
          .filter((cls) => !!cls.urlMappingValue);
    apexClasses = apexClasses?.filter((cls) => !cls.Body.includes('@RestResource'));
    this.spinner.stop(messages.getMessage('spinner.stop.found', [apexClasses.length]));

    this.spinner.start(messages.getMessage('spinner.start.retrieveAura'));
    const auracmps = await this.query(AURAQUERY);
    this.spinner.stop(messages.getMessage('spinner.stop.found', [auracmps.length]));

    // retrieve integration settings
    this.spinner.start(messages.getMessage('spinner.start.retrieveNameCredentials'));
    const namedCredentials = await this.query(NAMEDCREDQUERY);
    this.spinner.stop(messages.getMessage('spinner.stop.found', [namedCredentials.length]));
    this.spinner.start(messages.getMessage('spinner.start.retrieveConnected'));
    const connectedApps: any = await this.getConnectedAppUsage(await this.query(CONNECTEDAPPQUERY));
    this.spinner.stop(messages.getMessage('spinner.stop.found', [connectedApps.length]));

    // finalizing and create actual documet
    await this.createPdfDocument({
      format,
      orginfo,
      ssoSettings,
      standardObjects,
      customObjects,
      apexClasses,
      apexRestResource,
      apexTestClasses,
      connectedApps,
      namedCredentials,
      documentMeta,
      cssPath,
      pdfPath,
      htmlPath,
      flows,
    });
    return { success: true };
  }
  /**
   * Get components from manifest(package.xml)
   *
   * @param {string} manifest - Manifest file path
   * @returns {void}
   */
  private async getComponentsFromManifest(manifest: string): Promise<void> {
    const data = await fs.readFile(manifest, { encoding: 'utf8' });
    const result = (
      await xml2js.parseStringPromise(data, {
        explicitArray: false,
      })
    )?.Package;
    this.packageCmps = {};
    result.types.forEach((elem: { name: string; members: string[] }) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.packageCmps![elem.name] = this.toArray(elem.members);
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
  private async createPdfDocument(doc: DocumentDefinition): Promise<void> {
    const {
      orginfo,
      ssoSettings,
      standardObjects,
      customObjects,
      apexClasses,
      apexRestResource,
      apexTestClasses,
      connectedApps,
      namedCredentials,
      documentMeta,
      cssPath,
      pdfPath,
      htmlPath,
      flows,
    } = doc;
    this.spinner.start(messages.getMessage('spinner.start.createDoc', [doc.format]));
    // load resources
    const htmlTemplate = fs.readFileSync(htmlPath, { encoding: 'utf8' });
    const pdfTemplate = fs.readFileSync(pdfPath, { encoding: 'utf8' });
    const css = fs.readFileSync(cssPath, { encoding: 'utf8' });
    // init doc metadata
    const document = {
      html: pdfTemplate,
      data: {
        orginfo,
        ssoSettings,
        // eslint-disable-next-line camelcase
        std_objects: standardObjects,
        // eslint-disable-next-line camelcase
        cust_objects: customObjects,
        apexClasses,
        apexRestResource,
        apexTestClasses,
        connectedApps,
        namedCredentials,
        diagrams: this.processImages(documentMeta.metadata.diagrams),
        document: documentMeta.documentInfo,
        style: css,
        flows,
      },
      path: `./${(documentMeta.documentInfo.title as string) ?? 'DXB Technical Design'}.pdf`,
      type: '',
    };
    if (doc.format === 'pdf') {
      await pdf.create(document, documentMeta.pdfOption);
    } else if (doc.format === 'html') {
      const htmlFile = Handlebars.compile(htmlTemplate)(document.data);
      fs.writeFileSync(`./${(documentMeta.documentInfo.title as string) ?? 'DXB Technical Design'}.html`, htmlFile);
    } else if (doc.format === 'docx') {
      const htmlFile = Handlebars.compile(htmlTemplate)(document.data);
      const optDocX: any = {
        margin: {
          top: 100,
        },
        orientation: 'landscape', // type error: because typescript automatically widen this type to 'string' but not 'Orient' - 'string literal type'
      };
      const docx: any = await asBlob(htmlFile, optDocX);
      fs.writeFileSync(`./${(documentMeta.documentInfo.title as string) ?? 'DXB Technical Design'}.docx`, docx);
    } else {
      throw messages.createError('error.invalidFormat', [doc.format]);
    }
    // the below convert and create md file
    // const mdFile = NodeHtmlMarkdown.translate(
    //     /* html */ htmlFile,
    //     /* options (optional) */ {},
    //     /* customTranslators (optional) */ undefined,
    //     /* customCodeBlockTranslators (optional) */ undefined
    // );
    // fs.writeFileSync(`./${documentMeta.documentInfo.title ?? 'DXB Technical Design'}.md`, mdFile);
    // gen docx
    this.spinner.stop(messages.getMessage('spinner.stop.done'));
  }
  /**
   * Retrieves Apex classes from the Salesforce org.
   *
   * @returns {Promise<Array>} A Promise that resolves to an array of Apex classes.
   */
  private async getApexClasses(): Promise<ApexClassDestruct[]> {
    return (await this.query(APEXCLSQUERY)).map((cls: ObjectDefinition) => ({
      ...cls,
      Body: cls.Body.length < 100 ? cls.Body : cls.Body.substring(0, 100),
    }));
  }
  /**
   * Processes images and returns the diagrams object including based64 data src for each img
   *
   * @param {Object} diagrams - An object containing diagrams.
   * @returns {Object} An object containing processed diagrams.
   */
  // eslint-disable-next-line class-methods-use-this
  private processImages(diagrams: any): Diagram {
    // read binary data
    const d: Diagram = { ...diagrams };
    if (d.standard) {
      const bitmap = fs.readFileSync(d.standard.path);
      const mimetype = mime.getType(d.standard.path);
      d.standard = {
        ...d.standard,
        src: `data:${mimetype as string};base64,${Buffer.from(bitmap).toString('base64')}`,
      };
    }
    if (d.custom) {
      const bitmap = fs.readFileSync(d.custom.path);
      const mimetype = mime.getType(d.custom.path);
      d.custom = {
        ...d.custom,
        src: `data:${mimetype as string};base64,${Buffer.from(bitmap).toString('base64')}`,
      };
    }
    return d;
  }
  /**
   * Gets the usage count of each connected app.
   *
   * @param {any[]} apps - The array of connected apps to retrieve usage count for.
   * @returns {Promise<any[]>} An array of objects containing the app and its usage count.
   */
  private async getConnectedAppUsage(apps: ObjectDefinition[]): Promise<ConnectedAppDestruct[] | undefined> {
    if (!apps) {
      return undefined;
    }

    const usagePromises = apps.map(async (app) => {
      try {
        const result: Record[] | undefined = (
          await this.connection?.query(`SELECT COUNT() FROM OauthToken where AppName = '${app.Name as string}'`)
        )?.records;
        return { ...app, usage: result?.length ?? 0 };
      } catch (err) {
        return { ...app, usage: 0 };
      }
    });
    return Promise.all(usagePromises);
  }
  /**
   * Retrieves a list of Flow Definitions from the Salesforce Metadata API, split into chunks of 10 records.
   *
   * @returns {Promise<any[]>} An array of Flow Definition records.
   */
  private async getFlowDefinitions(): Promise<Flow[]> {
    const flows = await this.query(FLOWQUERY);
    if (flows) {
      const fullNameList = flows.map((f: ObjectDefinition) => f.ApiName as string);
      const chunkSize = 10;
      const chunks: string[] = [];
      // Split the array into chunks of 10 records
      fullNameList.forEach((name, index) => {
        const chunk: string[] = fullNameList.slice(index, index + chunkSize);
        chunks.push(...chunk);
      });

      return Promise.all(chunks.map((c) => this.connection!.metadata.read('Flow', c)));
    }
    return [];
  }
  /**
   * Process flow metadata to add dml counts
   *
   * @param {Object[]} flows - An array of flows
   * @returns {Object[]} An array of processed flows
   */
  // eslint-disable-next-line class-methods-use-this
  private processFlow(flows: Flow[]): FlowDestruct[] {
    return flows.map((f: Flow) => ({
      ...f,
      recordCreateCount: f.recordCreates?.length | 0,
      recordLookupCount: f.recordLookups?.length | 0,
      recordUpdateCount: f.recordUpdates?.length | 0,
    }));
  }
  private async getFlowDefinitionForSObject(sobjects: string[]): Promise<Array<Flow | undefined>> {
    const flows = await this.query(AUTOFLOWQUERY.split('{{object_name}}').join(`'${sobjects.join("','")}'`));
    if (flows) {
      const fullNameList = flows.map((f: any) => f.ApiName as string);
      const chunkSize = 10;
      const chunks: string[] = [];
      // Split the array into chunks of 10 records
      fullNameList.forEach((_name, index) => {
        const chunk = fullNameList.slice(index, index + chunkSize);
        chunks.push(...chunk);
      });

      return Promise.all(chunks.map((c) => this.connection?.metadata.read('Flow', c)));
    }
    return [];
  }
  /**
   * Fetches the trigger information for a list of sObjects from a pre-fetched list of all triggers.
   *
   * @param {Array} sobjects - List of sObjects to fetch trigger information for.
   * @param {Array} allTriggers - List of all triggers fetched from the org.
   * @returns {Array} - An array of sObjects with trigger information.
   */
  private getTriggerForSObject(sobjects: ObjectDefinition[], allTriggers: ObjectDefinition[]): TriggerDescruct[] {
    // Convert the list of triggers to a map with sObject names as keys
    const triggerMap = allTriggers.reduce((acc: any, cur): any => {
      if (!acc[cur.TableEnumOrId]) {
        acc[cur.TableEnumOrId] = [];
      }
      acc[cur.TableEnumOrId].push(cur);
      return acc;
    }, {});

    // Add trigger information to each sObject in the list
    return sobjects
      .filter((sobject) => !!sobject)
      .map((sobject) => {
        const triggers = triggerMap[sobject.QualifiedApiName] as ObjectDefinition[];
        const triggerInfo = triggers
          ? triggers.map((trigger) => {
              const operations = this.processTrigger(trigger);
              return { ...trigger, operation: operations };
            })
          : [];
        return {
          ...sobject,
          triggers: triggerInfo,
          hasTriggers: triggers?.length > 0,
        };
      });
  }
  /**
   * Processes the trigger object to create an array of user friendly operations name
   *
   * @param {any} trigger - The trigger object
   * @returns {Array} - An array of operations
   */
  // eslint-disable-next-line class-methods-use-this
  private processTrigger(trigger: ObjectDefinition): Array<{ name: string }> {
    const operations = [];
    if (trigger.UsageBeforeInsert) operations.push({ name: 'Before Insert' });
    if (trigger.UsageAfterInsert) operations.push({ name: 'After Insert' });
    if (trigger.UsageBeforeUpdate) operations.push({ name: 'Before Update' });
    if (trigger.UsageAfterUpdate) operations.push({ name: 'After Update' });
    if (trigger.UsageBeforeDelete) operations.push({ name: 'Before Delete' });
    if (trigger.UsageAfterDelete) operations.push({ name: 'After Delete' });
    if (trigger.UsageAfterUndelete) operations.push({ name: 'After Undelete' });
    return operations;
  }
  /**
   * Fetches the field definition for a list of sObjects in chunks of 10 using the provided SOQL query.
   *
   * @param {Array} sobjects - List of sObject names to fetch field definition for.
   * @returns {Promise<Array>} - A Promise that resolves to an array of field definition objects.
   */
  private async getFieldDefinitionForSObject(sobjects: string[]): Promise<ObjectDefinition[][]> {
    const chunkSize = 10;
    const chunks: string[][] = [];
    // Split the array into chunks of 10 records
    sobjects.forEach((_name, index) => {
      const chunk = sobjects.slice(index, index + chunkSize);
      chunks.push(chunk);
    });
    return Promise.all(
      chunks.map(async (c) => this.query(FIELDQUERY.split('{{object_name}}').join(`'${c.join("','")}'`)))
    );
  }
  /**
   * This method is used to get the sharing rules metadata of an array of fullNames.
   * It takes in an array of fullNames as a parameter and returns a promise with the metadata.
   *
   * @param {array} fullNames - An array of fullNames
   * @returns {Promise<Array>} - An array of sharing rules metadata
   */
  private async getSharingRulesMetadata(fullNames: string[]): Promise<SharingRulesMetadata[][]> {
    const chunkSize = 5;
    const chunks: string[] = [];

    // Split the array into chunks of 10 records
    fullNames.forEach((_name, index) => {
      const chunk = fullNames.slice(index, index + chunkSize);
      chunks.push(...chunk);
    });
    return Promise.all(
      chunks.map(async (c) =>
        (this.toArray(await this.connection?.metadata.read('SharingRules', c)) as SharingRules[]).map(
          (sh: SharingRules) => {
            if (sh?.fullName) {
              let { sharingCriteriaRules, sharingOwnerRules } = sh;
              if (sharingCriteriaRules) {
                sharingCriteriaRules = this.toArray(sharingCriteriaRules).map((shc: SharingCriteriaRule) => {
                  shc.criteriaItems = this.toArray(shc.criteriaItems);
                  shc.sharedTo = this.formatSharedInfo(this.toArray(shc.sharedTo)) as unknown as SharedTo;
                  return { ...shc };
                });
              }
              if (sharingOwnerRules) {
                sharingOwnerRules = this.toArray(sharingOwnerRules).map((sho: SharingOwnerRule) => {
                  sho.sharedTo = this.formatSharedInfo(this.toArray(sho.sharedTo)) as unknown as SharedTo;
                  sho.sharedFrom = this.formatSharedInfo(this.toArray(sho.sharedFrom)) as unknown as SharedTo;
                  return { ...sho };
                });
              }
              return { ...sh, sharingOwnerRules, sharingCriteriaRules };
            } else {
              return { ...sh, sharingOwnerRules: [], sharingCriteriaRules: [] };
            }
          }
        )
      )
    );
  }
  /**
   * Retrieves the SSO setting metadata
   *
   * @returns {Promise<Array>} - An array of SSO setting metadata
   */
  private async getSSOSettingMetadata(apiVersion: string): Promise<SamlSsoConfig[]> {
    const types = [{ type: 'SamlSsoConfig', folder: null }];
    const list: FileProperties[] = this.toArray(await this.connection?.metadata.list(types, apiVersion));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const fullNameList = list.map((e) => e.fullName);
    return this.toArray(await this.connection?.metadata.read('SamlSsoConfig', fullNameList)) as SamlSsoConfig[];
  }

  /**
   * Retrieves custom object metadata from Salesforce for a given list of object api name by using jsforce.
   * Jsforce limit to max 10 objects per called so the method split by chunk
   *
   * @param {string} type - Type of metadata object
   * @param {array} fullNames - Array of fullNames for the metadata object
   * @returns {Promise} - Returns a promise
   */
  private async getMetadataObject(
    type: string,
    fullNames: string[]
  ): Promise<Array<MetadataDefinition<string, CustomObjectComponent>>> {
    const chunkSize = 5;
    const chunks: string[] = [];

    // Split the array into chunks of 10 records
    fullNames.forEach((_name, index) => {
      const chunk = fullNames.slice(index, index + chunkSize);
      chunks.push(...chunk);
    });
    return Promise.all(chunks.map((c) => this.connection?.metadata.read(type as MetadataType, c))) as Promise<
      Array<MetadataDefinition<string, CustomObjectComponent>>
    >;
  }
  /**
   * Get the object definition of given sobjects with its metadata, sharing rules metadata, and field definition
   *
   * @param {Array} sobjects - Array of sobject types to fetch definition for
   * @param {string} type - Type of the metadata to fetch
   * @param {Array} fullNames - Array of full names for the metadata to fetch
   * @returns {Array} - Array of sobjects with its metadata, sharing rules metadata, field definition, and other related information
   */
  private async getObjectDefinition(
    sobjects: ObjectDefinition[],
    type: string,
    fullNames: string[]
  ): Promise<ObjectDefinition[]> {
    // get object and related element metadata
    const metadata: Array<MetadataDefinition<string, CustomObjectComponent>> = (
      await this.getMetadataObject(type, fullNames)
    ).flat();
    const sharingRulesArray: SharingRulesMetadata[] = (await this.getSharingRulesMetadata(fullNames)).flat();
    const fieldsArray = await this.getFieldDefinitionForSObject(fullNames);
    const flowsArray = await this.getFlowDefinitionForSObject(fullNames);
    let objectFlows = new Map<string, Flow[]>();
    if (flowsArray) {
      objectFlows = flowsArray.flat().reduce((acc, cur) => {
        if (acc.has(cur!.start!.object!)) {
          acc.get(cur!.start!.object!)!.push(cur!);
        } else {
          acc.set(cur!.start!.object!, [cur!]);
        }
        return acc;
      }, new Map<string, Flow[]>());
    }
    const objectFields: Map<string, ObjectDefinition[]> = fieldsArray.flat().reduce((acc, cur) => {
      if (acc.has(cur.EntityDefinition.QualifiedApiName)) {
        acc.get(cur.EntityDefinition.QualifiedApiName)?.push(cur);
      } else {
        acc.set(cur.EntityDefinition.QualifiedApiName, [cur]);
      }
      return acc;
    }, new Map<string, ObjectDefinition[]>());
    // decorate object with other metadata
    return sobjects
      .filter((o: ObjectDefinition) => metadata.find((e) => e?.fullName && e.fullName === o.QualifiedApiName))
      .map((o: ObjectDefinition) => {
        const objectMeta: MetadataDefinition<string, CustomObjectComponent> = metadata.find(
          (e) => e?.fullName && e.fullName === o.QualifiedApiName
        )!;
        const sharingRules = sharingRulesArray.find((e) => e?.fullName && e.fullName === o.QualifiedApiName);
        let autoflows = objectFlows.get(o.QualifiedApiName);
        if (autoflows && this.packageCmps?.Flow) {
          autoflows = autoflows?.filter((e: any) => this.packageCmps?.Flow.includes(e.fullName));
        }
        const fields = objectFields.get(o.QualifiedApiName);
        if (objectMeta?.fields) {
          objectMeta.fields = this.toArray(objectMeta.fields);
          objectMeta.fields = objectMeta.fields
            .filter((mf) => fields?.find((e) => mf.fullName === e.QualifiedApiName))
            .map((mf) => {
              const f = fields?.find((e) => mf.fullName === e.QualifiedApiName);
              return {
                ...f,
                ...mf,
                summaryFilterItems: this.toArray(mf.summaryFilterItems),
              };
            });
        }
        objectMeta.hasValidations = !!objectMeta.validationRules;
        if (objectMeta.hasValidations) {
          objectMeta.validationRules = this.toArray(objectMeta.validationRules);
        }
        objectMeta.hasRecordTypes = !!objectMeta.recordTypes;
        if (objectMeta.hasRecordTypes) {
          objectMeta.recordTypes = this.toArray(objectMeta.recordTypes);
          if (objectMeta.recordTypes && this.packageCmps?.RecordType) {
            objectMeta.recordTypes = objectMeta.recordTypes?.filter((e: any) =>
              this.packageCmps?.RecordType.includes(`${o.QualifiedApiName as string}.${e.fullName as string}`)
            );
          }
        }
        objectMeta.hasListViews = !!objectMeta.listViews;
        if (objectMeta.hasListViews) {
          if (!Array.isArray(objectMeta.listViews)) {
            objectMeta.listViews = this.toArray(objectMeta.listViews);
          }
          objectMeta.listViews.forEach((lv: ListViewComponent) => {
            lv.hasFilters = !!lv.filters;
            if (lv.hasFilters) {
              lv.filters = this.toArray(lv.filters);
            }
            lv.hasShareTo = !!lv.sharedTo;
            if (lv.hasShareTo) {
              lv.sharedTo = this.formatSharedInfo(this.toArray(lv.sharedTo)) as unknown as SharedTo;
            }
          });
        }
        const sharingCriteriaRules = sharingRules?.sharingCriteriaRules;
        const sharingOwnerRules = sharingRules?.sharingOwnerRules;
        const hasSharingRules = !!sharingCriteriaRules || !!sharingOwnerRules;
        return {
          ...o,
          ...objectMeta,
          hasAutoFlows: !!autoflows,
          autoflows,
          hasSharingRules,
          hasOwnerSharingRules: !!sharingOwnerRules,
          hasCriteriaSharingRules: !!sharingCriteriaRules,
          sharingCriteriaRules,
          sharingOwnerRules,
        };
      });
  }
  /**
   * Formats the shared object (sharedTo and sharedFrom)
   *
   * @param {Object} sharedInfo - The object to be formatted
   * @returns {Array} formattedSharedTo - The formatted object
   */
  private formatSharedInfo(sharedInfo: any[]): any[] {
    const formattedSharedTo: any[] = [];
    sharedInfo.forEach((r) => {
      for (const k in r) {
        if (Object.prototype.hasOwnProperty.call(r, k)) {
          const value = r[k] ? (Array.isArray(r[k]) ? r[k].toString() : r[k]) : '';
          formattedSharedTo.push({ label: this.toCapitalCase(k), value });
        }
      }
    });
    return formattedSharedTo;
  }
  /**
   * Converts the first character of a string to uppercase.
   *
   * @param {string} str - The string to be converted.
   * @returns {string} - The string with the first character in uppercase.
   */
  // eslint-disable-next-line class-methods-use-this
  private toCapitalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  /**
   * Converts an object to an array
   *
   * @param {Object} prop - The object to convert
   * @returns {Array} An array representation of the object
   */
  // eslint-disable-next-line class-methods-use-this
  private toArray(prop: any): any[] {
    return Array.isArray(prop) ? prop : [{ ...prop }];
  }
  /**
   * Executes a SOQL query
   *
   * @param {string} soql - The SOQL query to execute
   * @returns {Promise} The records returned from the query
   */
  private async query(soql: string): Promise<ObjectDefinition[]> {
    try {
      return (await this.connection?.query(soql))?.records as ObjectDefinition[];
    } catch (err) {
      return [];
    }
  }
}
