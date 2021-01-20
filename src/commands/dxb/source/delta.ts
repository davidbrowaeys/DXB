import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxProject } from '@salesforce/core';
import {execSync as exec} from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

let basedir: string;
let diff_filter= "AMR";
export default class extends SfdxCommand {

  public static description = 'This command generate delta package by doing git diff.';

  public static examples = [
    `$ sfdx dxb:source:delta -m tags -k mytag`,
    `$ sfdx dxb:source:delta -m branch -k origin/master`,
    `$ sfdx dxb:source:delta -m branch -k origin/master -p deltamanifest`,
    `$ sfdx dxb:source:delta -m commitid -k 123456`,
  ];

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    mode: flags.string({ char: 'm', description: 'commitid|tags|branch', default: "commitid" }),
    deltakey: flags.string({ char: 'k', description: 'commit id, tags prefix or name, branch name' }),
    basedir: flags.string({ char: 'd', description: 'path of base directory', default: 'force-app/main/default' }),
    outputpackage: flags.string({ char: 'p', description: 'output path of the package.xml to generate, i.e.: ./manifest'}),
    testclsnameregex: flags.string({ char: 'n', description: 'Regex for test classes naming convention', default: '.*Test' }),
    destructivechange: flags.boolean({char: 'x', description: 'Indicate if need to generate destructivePackage.xml (experimental not working yet)', default: false})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  protected testClasses: string[] = [];
  protected allClasses: string[] = [];
  protected processedClasses: string[] = [];
  protected regex;
  protected projectConfig;

  public async run() {
    //project config
    const project = await SfdxProject.resolve();
    this.projectConfig = await project.resolveProjectConfig();
    //flags
    let mode = this.flags.mode;
    let deltakey = this.flags.deltakey;
    let outputpackage = this.flags.outputpackage;
    this.regex = this.flags.testclsnameregex;
    basedir = this.flags.basedir;
    let destructivechange = this.flags.destructivechange;
    //run delta
    let deltaMeta = this.getDeltaChanges(mode, deltakey);
    if (destructivechange){
      let deleteFiles = this.getDeltaChanges(mode, deltakey,'D');
      this.buildPackageXml(outputpackage,deleteFiles,'destructiveChanges.xml');
    }
    //build package.xml ?   
    if (outputpackage){
      return {deltaMeta:this.buildPackageXml(outputpackage,deltaMeta, 'package.xml')};
    }
    let deployOutput = '';
    if (deltaMeta && deltaMeta.length > 0) {
      deployOutput += `${deltaMeta.join(',')}`;
    } 
    this.ux.log(deployOutput);
    return { deltaMeta }
  }
  private buildPackageXml(outputpackage,deltaMeta, packageFileName){
    var js2xmlparser = require('js2xmlparser');
    var packageJson:any = {
      '@': { xmlns: 'http://soap.sforce.com/2006/04/metadata' },
      'version' : this.projectConfig.sourceApiVersion,
      types : []
    };
    var requiredParent = ['Report','Dashboard', 'EmailTemplate','Document']
    var requiredParentOnly = ['LightningComponentBundle','AuraDefinitionBundle', 'StaticResource','CustomObject','ExperienceBundle'];
    var useWildcard = ['QuickAction'];
    //transform here
    deltaMeta.forEach(file => {
      file = path.parse(file);
      var metadataDir = file.dir.split(basedir).join('').split('/').filter( x => x != '');
      if (metadataConfig[metadataDir[0]]){
        var metaType = metadataConfig[metadataDir[0]];
        var fileName = file.name.split(new RegExp('\\.','g'))[0];
        
        var tp = packageJson.types.find((t:any) => t.name === metaType);
        if (!tp){
          tp = {
            members:[],
            name : metaType
          }
          packageJson.types.push(tp);
        }
        if (useWildcard.includes(metaType)){
          fileName = '*'
        }
        if ( (requiredParent.includes(metaType) && metadataDir[1]) || requiredParentOnly.includes(metaType)){
          if(metadataDir[1] && !tp.members.includes(metadataDir[1])){
            tp.members.push(metadataDir[1]);
            fileName = metadataDir[1] +'/'+fileName;
          }
        }
        if (fileName && !tp.members.includes(fileName) && !requiredParentOnly.includes(metaType)) tp.members.push(fileName);
      }
    });
    //write package.xml
    if (!fs.existsSync(outputpackage)) {
        fs.mkdirSync(outputpackage);
    }
    var xml = js2xmlparser.parse("Package", packageJson, { declaration: { encoding: 'UTF-8' }});
    fs.writeFileSync(path.join(outputpackage,packageFileName), xml);
  }
  private onlyUnique(value: any, index: any, self: any) {
    return self.indexOf(value) === index && value.startsWith(basedir) && value.indexOf('lwc/jsconfig.json') < 0;
  }
  public getDeltaChanges(mode: any, deltakey: any,filter:string='AMR'): any {
    var gitresult;
    if (mode === 'branch') {
      gitresult = exec(`git diff ${deltakey} --name-only --diff-filter=${filter}`).toString().split('\n');
    } else if (mode === 'tags') {
      if (deltakey) {
        gitresult = exec(`git diff $(git describe --match ${deltakey}* --abbrev=0 --all)..HEAD --name-only --diff-filter=AMR`).toString().split('\n');
      } else {
        gitresult = exec(`git diff $(git describe --tags --abbrev=0 --all)..HEAD --name-only --diff-filter=AMR`).toString().split('\n');
      }
    } else {
      gitresult = exec(`git diff --name-only ${deltakey} --diff-filter=AMR`).toString().split('\n'); //this only work with specific commit ids, how to get file that changed since last tag ? 
    }
    //filter unnecessary files
    var files = gitresult.filter(this.onlyUnique);
    return files;
  }
}

const metadataConfig = {
  "installedPackages": "InstalledPackage",
  "labels": "CustomLabels",
  "staticresources": "StaticResource",
  "scontrols": "Scontrol",
  "certs": "Certificate",
  "messageChannels": "LightningMessageChannel",
  "aura": "AuraDefinitionBundle",
  "lwc": "LightningComponentBundle",
  "components": "ApexComponent",
  "pages": "ApexPage",
  "queues": "Queue",
  "CaseSubjectParticles": "CaseSubjectParticle",
  "dataSources": "ExternalDataSource",
  "namedCredentials": "NamedCredential",
  "externalServiceRegistrations": "ExternalServiceRegistration",
  "roles": "Role",
  "groups": "Group",
  "globalValueSets": "GlobalValueSet",
  "standardValueSets": "StandardValueSet",
  "customPermissions": "CustomPermission",
  "objects": "CustomObject",
  "businessProcesses": "BusinessProcess",
  "compactLayouts": "CompactLayout",
  "fields": "CustomField",
  "fieldSets": "FieldSet",
  "listViews": "ListView",
  "recordTypes": "RecordType",
  "sharingReasons": "SharingReason",
  "validationRules": "ValidationRule",
  "webLinks": "WebLink",
  "reportTypes": "ReportType",
  "reports": "Report",
  "dashboards": "Dashboard",
  "analyticSnapshots": "AnalyticSnapshot",
  "feedFilters": "CustomFeedFilter",
  "layouts": "Layout",
  "documents": "Document",
  "weblinks": "CustomPageWebLink",
  "letterhead": "Letterhead",
  "email": "EmailTemplate",
  "quickActions": "QuickAction",
  "flexipages": "FlexiPage",
  "tabs": "CustomTab",
  "customApplicationComponents": "CustomApplicationComponent",
  "applications": "CustomApplication",
  "portals": "Portal",
  "customMetadata": "CustomMetadata",
  "flows": "Flow",
  "flowDefinitions": "FlowDefinition",
  "workflows": "Workflow",
  "assignmentRules": "AssignmentRules",
  "autoResponseRules": "AutoResponseRules",
  "escalationRules": "EscalationRules",
  "postTemplates": "PostTemplate",
  "approvalProcesses": "ApprovalProcess",
  "homePageComponents": "HomePageComponent",
  "homePageLayouts": "HomePageLayout",
  "objectTranslations": "CustomObjectTranslation",
  "translations": "Translations",
  "globalValueSetTranslations": "GlobalValueSetTranslation",
  "standardValueSetTranslations": "StandardValueSetTranslation",
  "classes": "ApexClass",
  "triggers": "ApexTrigger",
  "testSuites": "ApexTestSuite",
  "profiles": "Profile",
  "permissionsets": "PermissionSet",
  "mutingpermissionsets": "MutingPermissionSet",
  "permissionsetgroups": "PermissionSetGroup",
  "profilePasswordPolicies": "ProfilePasswordPolicy",
  "profileSessionSettings": "ProfileSessionSetting",
  "myDomainDiscoverableLogins": "MyDomainDiscoverableLogin",
  "oauthcustomscopes": "OauthCustomScope",
  "datacategorygroups": "DataCategoryGroup",
  "remoteSiteSettings": "RemoteSiteSetting",
  "cspTrustedSites": "CspTrustedSite",
  "redirectWhitelistUrls": "RedirectWhitelistUrl",
  "matchingRules": "MatchingRules",
  "duplicateRules": "DuplicateRule",
  "cleanDataServices": "CleanDataService",
  "skills": "Skill",
  "serviceChannels": "ServiceChannel",
  "queueRoutingConfigs": "QueueRoutingConfig",
  "servicePresenceStatuses": "ServicePresenceStatus",
  "presenceDeclineReasons": "PresenceDeclineReason",
  "presenceUserConfigs": "PresenceUserConfig",
  "workSkillRoutings": "WorkSkillRouting",
  "authproviders": "AuthProvider",
  "eclair": "EclairGeoData",
  "channelLayouts": "ChannelLayout",
  "contentassets": "ContentAsset",
  "sites": "CustomSite",
  "sharingRules": "SharingRules",
  "sharingSets": "SharingSet",
  "iframeWhiteListUrlSettings": "IframeWhiteListUrlSettings",
  "communities": "Community",
  "ChatterExtensions": "ChatterExtension",
  "platformEventChannels": "PlatformEventChannel",
  "platformEventChannelMembers": "PlatformEventChannelMember",
  "callCenters": "CallCenter",
  "milestoneTypes": "MilestoneType",
  "entitlementProcesses": "EntitlementProcess",
  "entitlementTemplates": "EntitlementTemplate",
  "timeSheetTemplates": "TimeSheetTemplate",
  "appointmentSchedulingPolicies": "AppointmentSchedulingPolicy",
  "Canvases": "CanvasMetadata",
  "MobileApplicationDetails": "MobileApplicationDetail",
  "notificationtypes": "CustomNotificationType",
  "connectedApps": "ConnectedApp",
  "appMenus": "AppMenu",
  "notificationTypeConfig": "NotificationTypeConfig",
  "delegateGroups": "DelegateGroup",
  "siteDotComSites": "SiteDotCom",
  "experiences": "ExperienceBundle",
  "networks": "Network",
  "networkBranding": "NetworkBranding",
  "brandingSets": "BrandingSet",
  "communityThemeDefinitions": "CommunityThemeDefinition",
  "communityTemplateDefinitions": "CommunityTemplateDefinition",
  "navigationMenus": "NavigationMenu",
  "audience": "Audience",
  "flowCategories": "FlowCategory",
  "lightningBolts": "LightningBolt",
  "lightningExperienceThemes": "LightningExperienceTheme",
  "lightningOnboardingConfigs": "LightningOnboardingConfig",
  "customHelpMenuSections": "CustomHelpMenuSection",
  "prompts": "Prompt",
  "managedTopics": "ManagedTopics",
  "moderation": "ModerationRule",
  "userCriteria": "UserCriteria",
  "cmsConnectSource": "CMSConnectSource",
  "managedContentTypes": "ManagedContentType",
  "territory2Types": "Territory2Type",
  "territory2Models": "Territory2Model",
  "rules": "Territory2Rule",
  "territories": "Territory2",
  "campaignInfluenceModels": "CampaignInfluenceModel",
  "samlssoconfigs": "SamlSsoConfig",
  "corsWhitelistOrigins": "CorsWhitelistOrigin",
  "actionLinkGroupTemplates": "ActionLinkGroupTemplate",
  "transactionSecurityPolicies": "TransactionSecurityPolicy",
  "liveChatDeployments": "LiveChatDeployment",
  "liveChatButtons": "LiveChatButton",
  "liveChatAgentConfigs": "LiveChatAgentConfig",
  "synonymDictionaries": "SynonymDictionary",
  "pathAssistants": "PathAssistant",
  "animationRules": "AnimationRule",
  "LeadConvertSettings": "LeadConvertSettings",
  "liveChatSensitiveDataRule": "LiveChatSensitiveDataRule",
  "cachePartitions": "PlatformCachePartition",
  "topicsForObjects": "TopicsForObjects",
  "recommendationStrategies": "RecommendationStrategy",
  "emailservices": "EmailServicesFunction",
  "recordActionDeployments": "RecordActionDeployment",
  "EmbeddedServiceConfig": "EmbeddedServiceConfig",
  "EmbeddedServiceLiveAgent": "EmbeddedServiceLiveAgent",
  "EmbeddedServiceBranding": "EmbeddedServiceBranding",
  "EmbeddedServiceFlowConfig": "EmbeddedServiceFlowConfig",
  "EmbeddedServiceMenuSettings": "EmbeddedServiceMenuSettings",
  "settings": "Settings"
}