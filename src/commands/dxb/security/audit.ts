//_______________This Code was generated using GenAI tool: Codify, Please check for accuracy_______________//
import * as path from 'path';
import * as fs from 'fs-extra';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Connection, Messages, Org } from '@salesforce/core';

export type SecurityAuditResult = {
  reportPath?: string;
  findings: SecurityFinding[];
  summary: AuditSummary;
  sharingSettings?: SharingSettingsData;
  success: boolean;
};

interface SharingSettingsData {
  owdSettings: OWDSetting[];
  sharingConfig: SharingSettingsInfo[];
}

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface SecurityFinding {
  id: string;
  category: string;
  severity: Severity;
  title: string;
  description: string;
  affectedItems: string[];
  recommendation: string;
  reference?: string;
}

interface AuditSummary {
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  categoriesAudited: string[];
  auditDate: string;
  orgId?: string;
  orgName?: string;
  username?: string;
  instanceUrl?: string;
}

interface ProfileInfo {
  Id: string;
  Name: string;
  PermissionsModifyAllData: boolean;
  PermissionsViewAllData: boolean;
  PermissionsAuthorApex: boolean;
  PermissionsManageUsers: boolean;
  PermissionsApiEnabled: boolean;
  PermissionsViewSetup: boolean;
  PermissionsManageDataIntegrations: boolean;
}

interface PermissionSetInfo {
  Id: string;
  Name: string;
  Label: string;
  IsCustom: boolean;
  PermissionsModifyAllData: boolean;
  PermissionsViewAllData: boolean;
  PermissionsAuthorApex: boolean;
  PermissionsManageUsers: boolean;
  PermissionsApiEnabled: boolean;
}

interface ConnectedAppInfo {
  Id: string;
  Name: string;
  OptionsAllowAdminApprovedUsersOnly: boolean;
}

interface OWDSetting {
  developerName: string;
  internalAccess: string;
  externalAccess: string;
}

interface TrustedUrlInfo {
  name: string;
  url: string;
  context: string;
  isActive: boolean;
}

interface CspTrustedSiteMetadata {
  fullName: string;
  endpointUrl?: string;
  context?: string;
  isActive?: boolean | string;
}

interface RemoteSiteMetadata {
  fullName: string;
  url?: string;
  isActive?: boolean | string;
  disableProtocolSecurity?: boolean | string;
}

interface SharingSettingsMetadata {
  fullName?: string;
  enableSecureGuestAccess?: boolean | string;
  enableCommunityUserVisibility?: boolean | string;
  enablePortalUserVisibility?: boolean | string;
  enablePartnerSuperUserAccess?: boolean | string;
}

interface SharingSettingsInfo {
  setting: string;
  value: boolean;
  description: string;
  recommendation?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

const VALID_CATEGORIES = [
  'profiles', 'permissions', 'fields', 'sharing', 'guest-user',
  'session', 'password', 'apex', 'remote-sites', 'connected-apps', 'trusted-urls', 'monitoring',
];

const SENSITIVE_FIELD_PATTERNS = [
  /ssn/i, /social.*security/i, /credit.*card/i, /card.*number/i, /cvv/i,
  /password/i, /secret/i, /token/i, /api.*key/i, /private.*key/i,
  /bank.*account/i, /routing.*number/i, /tax.*id/i, /driver.*license/i, /passport/i, /national.*id/i,
];

interface SfdxProjectJson {
  packageDirectories: Array<{ path: string; default?: boolean }>;
}

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'security.audit');

export default class SecurityAudit extends SfCommand<SecurityAuditResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.string({ char: 'o', summary: messages.getMessage('flags.target-org.summary'), required: true }),
    categories: Flags.string({ char: 'c', summary: messages.getMessage('flags.categories.summary'), default: VALID_CATEGORIES.join(',') }),
    format: Flags.string({ char: 'r', summary: messages.getMessage('flags.format.summary'), options: ['html', 'markdown', 'json'], default: 'html' }),
    'output-dir': Flags.directory({ char: 'd', summary: messages.getMessage('flags.output-dir.summary') }),
    'severity-threshold': Flags.string({ char: 's', summary: messages.getMessage('flags.severity-threshold.summary'), options: ['critical', 'high', 'medium', 'low'] }),
    'include-recommendations': Flags.boolean({ char: 'i', summary: messages.getMessage('flags.include-recommendations.summary'), default: true }),
    'source-path': Flags.directory({ char: 'p', summary: messages.getMessage('flags.source-path.summary') }),
  };

  private connection!: Connection;
  private findings: SecurityFinding[] = [];
  private owdSettings: OWDSetting[] = [];
  private trustedUrls: TrustedUrlInfo[] = [];
  private sharingSettings: SharingSettingsInfo[] = [];
  private findingCounter = 0;
  private orgInfo: { orgId?: string; orgName?: string; username?: string; instanceUrl?: string } = {};

  public async run(): Promise<SecurityAuditResult> {
    const { flags } = await this.parse(SecurityAudit);
    const categories = flags.categories.split(',').map((c) => c.trim().toLowerCase());
    
    for (const category of categories) {
      if (!VALID_CATEGORIES.includes(category)) {
        throw messages.createError('error.invalidCategory', [category]);
      }
    }

    const org: Org = await Org.create({ aliasOrUsername: flags['target-org'] });
    this.connection = org.getConnection();
    this.orgInfo = { orgId: org.getOrgId(), username: this.connection.getUsername(), instanceUrl: this.connection.instanceUrl };

    try {
      const orgData = await this.connection.query<{ Name: string }>('SELECT Name FROM Organization LIMIT 1');
      if (orgData.records.length > 0) this.orgInfo.orgName = orgData.records[0].Name;
    } catch { /* ignore */ }

    this.log(`Starting security audit for org: ${flags['target-org']}`);
    this.log(`Categories: ${categories.join(', ')}`);

    if (categories.includes('profiles')) await this.auditProfiles();
    if (categories.includes('permissions')) await this.auditPermissionSets();
    if (categories.includes('fields')) await this.auditFieldLevelSecurity();
    if (categories.includes('sharing')) await this.auditSharingSettings();
    if (categories.includes('guest-user')) await this.auditGuestUserAccess();
    if (categories.includes('session')) await this.auditSessionSettings();
    if (categories.includes('password')) await this.auditPasswordPolicies();
    if (categories.includes('apex')) await this.auditApexSecurity(flags['source-path']);
    if (categories.includes('remote-sites')) await this.auditRemoteSites();
    if (categories.includes('connected-apps')) await this.auditConnectedApps();
    if (categories.includes('trusted-urls')) await this.auditTrustedUrls();
    if (categories.includes('monitoring')) await this.auditMonitoringAndLogging();

    const summary = this.generateSummary(categories);

    if (flags['severity-threshold']) {
      const threshold = flags['severity-threshold'] as Severity;
      const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low'];
      const thresholdIndex = severityOrder.indexOf(threshold);
      const findingsAboveThreshold = this.findings.filter((f) => severityOrder.indexOf(f.severity) <= thresholdIndex);
      if (findingsAboveThreshold.length > 0) {
        this.warn(`Found ${findingsAboveThreshold.length} findings at or above ${threshold} severity`);
      }
    }

    if (flags['output-dir']) {
      const report = this.generateReport(summary, flags.format, flags['include-recommendations']);
      const fileName = `security-audit.${flags.format === 'json' ? 'json' : flags.format === 'html' ? 'html' : 'md'}`;
      const reportPath = path.join(flags['output-dir'], fileName);
      fs.ensureDirSync(flags['output-dir']);
      fs.writeFileSync(reportPath, report);
      this.log(`\nReport generated: ${reportPath}`);

      if (flags['severity-threshold']) {
        const threshold = flags['severity-threshold'] as Severity;
        const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low'];
        const thresholdIndex = severityOrder.indexOf(threshold);
        const findingsAboveThreshold = this.findings.filter((f) => severityOrder.indexOf(f.severity) <= thresholdIndex);
        if (findingsAboveThreshold.length > 0) {
          throw messages.createError('error.thresholdExceeded', [findingsAboveThreshold.length.toString(), threshold]);
        }
      }

      return { reportPath, findings: this.findings, summary, sharingSettings: this.owdSettings.length > 0 || this.sharingSettings.length > 0 ? { owdSettings: this.owdSettings, sharingConfig: this.sharingSettings } : undefined, success: true };
    } else {
      const report = this.generateReport(summary, flags.format, flags['include-recommendations']);
      this.log(report);
      return { findings: this.findings, summary, sharingSettings: this.owdSettings.length > 0 || this.sharingSettings.length > 0 ? { owdSettings: this.owdSettings, sharingConfig: this.sharingSettings } : undefined, success: true };
    }
  }

  private async auditProfiles(): Promise<void> {
    this.log('\n🔍 Auditing Profiles...');
    try {
      const profiles = await this.connection.query<ProfileInfo>(`SELECT Id, Name, PermissionsModifyAllData, PermissionsViewAllData, PermissionsAuthorApex, PermissionsManageUsers, PermissionsApiEnabled, PermissionsViewSetup, PermissionsManageDataIntegrations FROM Profile WHERE UserType = 'Standard'`);
      const dangerousProfiles: string[] = [];
      const apiEnabledProfiles: string[] = [];

      for (const profile of profiles.records) {
        if (profile.PermissionsModifyAllData && profile.Name !== 'System Administrator') dangerousProfiles.push(`${profile.Name} (ModifyAllData)`);
        if (profile.PermissionsViewAllData && profile.Name !== 'System Administrator') dangerousProfiles.push(`${profile.Name} (ViewAllData)`);
        if (profile.PermissionsAuthorApex && profile.Name !== 'System Administrator') dangerousProfiles.push(`${profile.Name} (AuthorApex)`);
        if (profile.PermissionsApiEnabled) apiEnabledProfiles.push(profile.Name);
      }

      if (dangerousProfiles.length > 0) {
        this.addFinding({ category: 'User Access & Authentication Review', severity: 'critical', title: 'Non-Admin Profiles with Dangerous Permissions', description: 'Profiles other than System Administrator have dangerous permissions.', affectedItems: dangerousProfiles, recommendation: 'Review and remove these permissions from non-admin profiles.', reference: 'https://help.salesforce.com/s/articleView?id=sf.admin_profile.htm' });
      }
      if (apiEnabledProfiles.length > 5) {
        this.addFinding({ category: 'User Access & Authentication Review', severity: 'medium', title: 'Many Profiles with API Access', description: `${apiEnabledProfiles.length} profiles have API access enabled.`, affectedItems: apiEnabledProfiles, recommendation: 'Review API access requirements and disable for profiles that do not need it.' });
      }
      this.log(`  ✓ Checked ${profiles.records.length} profiles`);
    } catch (error) {
      this.warn(`  ⚠ Could not audit profiles: ${(error as Error).message}`);
    }
  }

  private async auditPermissionSets(): Promise<void> {
    this.log('\n🔍 Auditing Permission Sets...');
    try {
      const permSets = await this.connection.query<PermissionSetInfo>(`SELECT Id, Name, Label, IsCustom, PermissionsModifyAllData, PermissionsViewAllData, PermissionsAuthorApex, PermissionsManageUsers, PermissionsApiEnabled FROM PermissionSet WHERE IsOwnedByProfile = false`);
      const dangerousPermSets: string[] = [];
      for (const ps of permSets.records) {
        if (ps.PermissionsModifyAllData) dangerousPermSets.push(`${ps.Label} (ModifyAllData)`);
        if (ps.PermissionsViewAllData) dangerousPermSets.push(`${ps.Label} (ViewAllData)`);
        if (ps.PermissionsAuthorApex) dangerousPermSets.push(`${ps.Label} (AuthorApex)`);
      }
      if (dangerousPermSets.length > 0) {
        this.addFinding({ category: 'User Access & Authentication Review', severity: 'high', title: 'Permission Sets with Elevated Privileges', description: 'Permission sets with dangerous system permissions found.', affectedItems: dangerousPermSets, recommendation: 'Review permission set assignments and consider using muting permission sets.', reference: 'https://help.salesforce.com/s/articleView?id=sf.perm_sets_overview.htm' });
      }
      this.log(`  ✓ Checked ${permSets.records.length} permission sets`);
    } catch (error) {
      this.warn(`  ⚠ Could not audit permission sets: ${(error as Error).message}`);
    }
  }

  private async auditFieldLevelSecurity(): Promise<void> {
    this.log('\n🔍 Auditing Field-Level Security...');
    try {
      const fields = await this.connection.query<{ Id: string; QualifiedApiName: string; EntityDefinition: { QualifiedApiName: string }; Description: string }>(`SELECT Id, QualifiedApiName, EntityDefinition.QualifiedApiName, Description FROM FieldDefinition WHERE EntityDefinition.IsCustomizable = true AND IsCompound = false LIMIT 2000`);
      const sensitiveFields: string[] = [];
      for (const field of fields.records) {
        const fieldName = field.QualifiedApiName.toLowerCase();
        const description = (field.Description || '').toLowerCase();
        for (const pattern of SENSITIVE_FIELD_PATTERNS) {
          if (pattern.test(fieldName) || pattern.test(description)) {
            sensitiveFields.push(`${field.EntityDefinition.QualifiedApiName}.${field.QualifiedApiName}`);
            break;
          }
        }
      }
      if (sensitiveFields.length > 0) {
        this.addFinding({ category: 'Sensitive Data Protection', severity: 'high', title: 'Potentially Sensitive Fields Detected', description: 'Fields with names suggesting sensitive data were found.', affectedItems: sensitiveFields, recommendation: 'Review field-level security settings for these fields.', reference: 'https://help.salesforce.com/s/articleView?id=sf.admin_fls.htm' });
      }
      this.log(`  ✓ Checked ${fields.records.length} fields`);
    } catch (error) {
      this.warn(`  ⚠ Could not audit field-level security: ${(error as Error).message}`);
    }
  }

  private async auditSharingSettings(): Promise<void> {
    this.log('\n🔍 Auditing Sharing Settings & OWD...');
    try {
      const owdQueryResult = await this.connection.query<{ Id: string; DeveloperName: string; InternalSharingModel: string; ExternalSharingModel: string }>(`SELECT Id, DeveloperName, InternalSharingModel, ExternalSharingModel FROM EntityDefinition WHERE IsCustomizable = true LIMIT 1000`);
      const externalReadObjects: string[] = [];
      const externalReadWriteObjects: string[] = [];
      const mismatchedObjects: string[] = [];
      this.owdSettings = [];

      for (const obj of owdQueryResult.records) {
        if (obj.ExternalSharingModel === 'Read' || obj.ExternalSharingModel === 'ReadWrite') {
          this.owdSettings.push({ developerName: obj.DeveloperName, internalAccess: obj.InternalSharingModel || 'N/A', externalAccess: obj.ExternalSharingModel || 'N/A' });
        }
        if (obj.ExternalSharingModel === 'Read') externalReadObjects.push(`${obj.DeveloperName} (External: Read)`);
        if (obj.ExternalSharingModel === 'ReadWrite') externalReadWriteObjects.push(`${obj.DeveloperName} (External: ReadWrite)`);
        const sharingOrder = ['Private', 'Read', 'ReadWrite', 'FullAccess'];
        const internalIndex = sharingOrder.indexOf(obj.InternalSharingModel);
        const externalIndex = sharingOrder.indexOf(obj.ExternalSharingModel);
        if (externalIndex > internalIndex && externalIndex >= 0 && internalIndex >= 0) {
          mismatchedObjects.push(`${obj.DeveloperName} (Internal: ${obj.InternalSharingModel}, External: ${obj.ExternalSharingModel})`);
        }
      }
      this.owdSettings.sort((a, b) => a.developerName.localeCompare(b.developerName));

      if (externalReadObjects.length > 5) this.addFinding({ category: 'Data Access Security', severity: 'high', title: 'Many Objects with External Read Access', description: `${externalReadObjects.length} objects have external OWD set to Read.`, affectedItems: externalReadObjects, recommendation: 'Review each object and consider setting external OWD to Private.', reference: 'https://help.salesforce.com/s/articleView?id=sf.security_sharing_owd_external.htm' });
      if (externalReadWriteObjects.length > 0) this.addFinding({ category: 'Data Access Security', severity: 'critical', title: 'Objects with External ReadWrite Access', description: `${externalReadWriteObjects.length} objects have external OWD set to ReadWrite.`, affectedItems: externalReadWriteObjects, recommendation: 'Review each object and restrict external OWD to Read or Private.', reference: 'https://help.salesforce.com/s/articleView?id=sf.security_sharing_owd_external.htm' });
      if (mismatchedObjects.length > 0) this.addFinding({ category: 'Data Access Security', severity: 'high', title: 'External OWD More Permissive Than Internal', description: 'Some objects have external sharing more permissive than internal.', affectedItems: mismatchedObjects, recommendation: 'Review these objects and ensure external access is not more permissive.' });
      this.log(`  ✓ Checked sharing settings for ${owdQueryResult.records.length} objects`);
    } catch (error) {
      this.warn(`  ⚠ Could not audit OWD settings: ${(error as Error).message}`);
    }
    await this.auditSharingSettingsMetadata();
  }

  private async auditSharingSettingsMetadata(): Promise<void> {
    this.log('  🔍 Auditing SharingSettings metadata...');
    try {
      const metadataResult = await this.connection.metadata.read('SharingSettings', 'SharingSettings');
      const settings = metadataResult as SharingSettingsMetadata;
      if (!settings) { this.log('    ✓ No SharingSettings metadata found'); return; }

      this.sharingSettings = [];
      const enableSecureGuestAccess = settings.enableSecureGuestAccess === true || String(settings.enableSecureGuestAccess) === 'true';
      this.sharingSettings.push({ setting: 'enableSecureGuestAccess', value: enableSecureGuestAccess, description: 'Secure Guest User Access - Restricts guest user record access', recommendation: 'Enable Secure Guest User Access to restrict guest user record visibility.', severity: 'critical' });

      if (!enableSecureGuestAccess) {
        this.addFinding({ category: 'Data Access Security', severity: 'critical', title: 'Secure Guest User Access Not Enabled', description: 'The "Secure Guest User Access" setting is disabled.', affectedItems: ['enableSecureGuestAccess: false'], recommendation: 'Enable "Secure Guest User Access" in Setup > Sharing Settings.', reference: 'https://help.salesforce.com/s/articleView?id=sf.networks_secure_guest_user_access.htm' });
      }

      const communityVisibility = settings.enableCommunityUserVisibility === true || String(settings.enableCommunityUserVisibility) === 'true';
      const portalVisibility = settings.enablePortalUserVisibility === true || String(settings.enablePortalUserVisibility) === 'true';
      if (communityVisibility || portalVisibility) {
        const visibilityIssues: string[] = [];
        if (communityVisibility) visibilityIssues.push('enableCommunityUserVisibility: true');
        if (portalVisibility) visibilityIssues.push('enablePortalUserVisibility: true');
        this.addFinding({ category: 'Data Access Security', severity: 'high', title: 'External User Visibility Enabled', description: 'Community or portal users can see other external users.', affectedItems: visibilityIssues, recommendation: 'Disable user visibility settings unless required.', reference: 'https://help.salesforce.com/s/articleView?id=sf.networks_user_visibility.htm' });
      }

      const partnerSuperUser = settings.enablePartnerSuperUserAccess === true || String(settings.enablePartnerSuperUserAccess) === 'true';
      if (partnerSuperUser) {
        this.addFinding({ category: 'Data Access Security', severity: 'high', title: 'Partner Super User Access Enabled', description: 'Partner super users can access all data owned by partner users.', affectedItems: ['enablePartnerSuperUserAccess: true'], recommendation: 'Disable Partner Super User Access unless specifically required.', reference: 'https://help.salesforce.com/s/articleView?id=sf.networks_partner_super_user.htm' });
      }
      this.log(`    ✓ Checked sharing settings`);
    } catch (error) {
      this.warn(`    ⚠ Could not audit SharingSettings metadata: ${(error as Error).message}`);
    }
  }

  private async auditGuestUserAccess(): Promise<void> {
    this.log('\n🔍 Auditing Guest User Access...');
    const dangerousGuestPermissions: string[] = [];
    const guestObjectAccess: string[] = [];
    let totalGuestProfiles = 0;

    try {
      const guestProfiles = await this.connection.query<{ Id: string; Name: string; PermissionsModifyAllData: boolean; PermissionsViewAllData: boolean; PermissionsApiEnabled: boolean }>(`SELECT Id, Name, PermissionsModifyAllData, PermissionsViewAllData, PermissionsApiEnabled FROM Profile WHERE UserType = 'Guest'`);
      for (const profile of guestProfiles.records) {
        const prefix = `[Guest] ${profile.Name}`;
        if (profile.PermissionsModifyAllData) dangerousGuestPermissions.push(`${prefix}: ModifyAllData`);
        if (profile.PermissionsViewAllData) dangerousGuestPermissions.push(`${prefix}: ViewAllData`);
        if (profile.PermissionsApiEnabled) dangerousGuestPermissions.push(`${prefix}: API Enabled`);
      }
      if (guestProfiles.records.length > 0) {
        const profileIds = guestProfiles.records.map((p) => `'${p.Id}'`).join(',');
        const objectPermissions = await this.connection.query<{ SobjectType: string; PermissionsCreate: boolean; PermissionsEdit: boolean; PermissionsDelete: boolean; Parent: { Name: string } }>(`SELECT SobjectType, PermissionsCreate, PermissionsEdit, PermissionsDelete, Parent.Name FROM ObjectPermissions WHERE ParentId IN (${profileIds}) AND (PermissionsCreate = true OR PermissionsEdit = true OR PermissionsDelete = true)`);
        for (const perm of objectPermissions.records) {
          const accessTypes: string[] = [];
          if (perm.PermissionsCreate) accessTypes.push('Create');
          if (perm.PermissionsEdit) accessTypes.push('Edit');
          if (perm.PermissionsDelete) accessTypes.push('Delete');
          if (accessTypes.length > 0) guestObjectAccess.push(`${perm.Parent?.Name}: ${perm.SobjectType} (${accessTypes.join(', ')})`);
        }
      }
      totalGuestProfiles = guestProfiles.records.length;
    } catch (error) {
      this.warn(`  ⚠ Could not audit guest profiles: ${(error as Error).message}`);
    }

    if (dangerousGuestPermissions.length > 0) this.addFinding({ category: 'User Access & Authentication Review', severity: 'critical', title: 'Guest Users with Dangerous Permissions', description: 'Guest user profiles have dangerous system permissions.', affectedItems: [...new Set(dangerousGuestPermissions)], recommendation: 'Remove all dangerous permissions from guest profiles immediately.', reference: 'https://help.salesforce.com/s/articleView?id=sf.networks_guest_user_profile.htm' });
    if (guestObjectAccess.length > 0) this.addFinding({ category: 'User Access & Authentication Review', severity: 'high', title: 'Guest Users with Create/Edit/Delete Access', description: 'Guest user profiles have data modification permissions.', affectedItems: [...new Set(guestObjectAccess)], recommendation: 'Review and remove unnecessary data modification permissions.' });
    this.log(`  ✓ Checked ${totalGuestProfiles} guest profiles`);
  }

  private async auditSessionSettings(): Promise<void> {
    this.log('\n🔍 Auditing Session Settings...');
    this.addFinding({ category: 'Platform Security Configuration', severity: 'low', title: 'Session Settings Review Recommended', description: 'Session settings should be reviewed manually.', affectedItems: ['Session timeout', 'Lock sessions to IP', 'MFA requirements', 'Clickjack protection'], recommendation: 'Navigate to Setup > Session Settings and verify security configurations.', reference: 'https://help.salesforce.com/s/articleView?id=sf.admin_sessions.htm' });
    this.log('  ✓ Session settings audit recommendation added');
  }

  private async auditPasswordPolicies(): Promise<void> {
    this.log('\n🔍 Auditing Password Policies...');
    this.addFinding({ category: 'Platform Security Configuration', severity: 'low', title: 'Password Policy Review Recommended', description: 'Password policies should be reviewed to ensure they meet security requirements.', affectedItems: ['Password length', 'Complexity requirements', 'Expiration', 'Lockout policy'], recommendation: 'Navigate to Setup > Password Policies and verify configurations.', reference: 'https://help.salesforce.com/s/articleView?id=sf.admin_password.htm' });
    this.log('  ✓ Password policy audit recommendation added');
  }

  private async auditApexSecurity(sourcePath?: string): Promise<void> {
    this.log('\n🔍 Auditing Apex Security...');
    const classesDirectories = this.getClassesDirectories(sourcePath);
    if (classesDirectories.length === 0) { this.warn('  ⚠ No classes directories found'); return; }

    const withoutSharingClasses: string[] = [];
    const soqlInjectionRisks: string[] = [];
    const hardcodedCredentials: string[] = [];
    let totalClassFiles = 0;

    for (const classesDir of classesDirectories) {
      const classFiles = fs.readdirSync(classesDir).filter((f) => f.endsWith('.cls'));
      totalClassFiles += classFiles.length;
      for (const file of classFiles) {
        const content = fs.readFileSync(path.join(classesDir, file), 'utf-8');
        const className = file.replace('.cls', '');
        const relativePath = path.relative(process.cwd(), path.join(classesDir, file));
        if (/without\s+sharing/i.test(content)) withoutSharingClasses.push(`${className} (${relativePath})`);
        if (/Database\.(query|getQueryLocator)\s*\([^)]*\+/i.test(content) || /\[\s*SELECT[^]]*\+/i.test(content)) soqlInjectionRisks.push(`${className} (${relativePath})`);
        if (/password\s*=\s*['"][^'"]+['"]/i.test(content) || /api[_-]?key\s*=\s*['"][^'"]+['"]/i.test(content)) hardcodedCredentials.push(`${className} (${relativePath})`);
      }
    }

    if (withoutSharingClasses.length > 0) this.addFinding({ category: 'Apex & Code Security', severity: 'high', title: 'Classes Using "without sharing"', description: 'Classes declared with "without sharing" bypass record-level security.', affectedItems: [...new Set(withoutSharingClasses)], recommendation: 'Review each class and change to "with sharing" unless required.', reference: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_keywords_sharing.htm' });
    if (soqlInjectionRisks.length > 0) this.addFinding({ category: 'Apex & Code Security', severity: 'critical', title: 'Potential SOQL Injection Vulnerabilities', description: 'Classes appear to use dynamic SOQL with string concatenation.', affectedItems: [...new Set(soqlInjectionRisks)], recommendation: 'Use bind variables instead of string concatenation in SOQL queries.', reference: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_dynamic_soql.htm' });
    if (hardcodedCredentials.length > 0) this.addFinding({ category: 'Apex & Code Security', severity: 'critical', title: 'Potential Hardcoded Credentials', description: 'Classes appear to contain hardcoded passwords or API keys.', affectedItems: [...new Set(hardcodedCredentials)], recommendation: 'Move credentials to Named Credentials or Custom Settings.', reference: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_callouts_named_credentials.htm' });
    this.log(`  ✓ Checked ${totalClassFiles} Apex classes`);
  }

  private getClassesDirectories(sourcePath?: string): string[] {
    const classesDirectories: string[] = [];
    if (sourcePath) {
      if (fs.existsSync(sourcePath)) {
        if (path.basename(sourcePath) === 'classes') classesDirectories.push(sourcePath);
        else {
          const classesPath = path.join(sourcePath, 'classes');
          if (fs.existsSync(classesPath)) classesDirectories.push(classesPath);
          else this.findClassesDirectories(sourcePath, classesDirectories);
        }
      }
      return classesDirectories;
    }
    const sfdxProjectPath = path.join(process.cwd(), 'sfdx-project.json');
    if (!fs.existsSync(sfdxProjectPath)) return classesDirectories;
    try {
      const sfdxProject: SfdxProjectJson = JSON.parse(fs.readFileSync(sfdxProjectPath, 'utf-8'));
      for (const pkgDir of sfdxProject.packageDirectories || []) {
        const pkgPath = path.join(process.cwd(), pkgDir.path);
        if (fs.existsSync(pkgPath)) this.findClassesDirectories(pkgPath, classesDirectories);
      }
    } catch { /* ignore */ }
    return classesDirectories;
  }

  private findClassesDirectories(dirPath: string, result: string[]): void {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.name === 'classes') result.push(fullPath);
          else if (!entry.name.startsWith('.') && entry.name !== 'node_modules') this.findClassesDirectories(fullPath, result);
        }
      }
    } catch { /* ignore */ }
  }

  private async auditRemoteSites(): Promise<void> {
    this.log('\n🔍 Auditing Remote Site Settings...');
    try {
      const listResult = await this.connection.metadata.list([{ type: 'RemoteSiteSetting' }]);
      if (!listResult || (Array.isArray(listResult) && listResult.length === 0)) { this.log('  ✓ No remote sites configured'); return; }
      const siteList = Array.isArray(listResult) ? listResult : [listResult];
      const siteNames = siteList.map((s) => s.fullName);
      const insecureSites: string[] = [];
      const httpSites: string[] = [];
      let activeCount = 0;
      const batchSize = 10;
      for (let i = 0; i < siteNames.length; i += batchSize) {
        const batch = siteNames.slice(i, i + batchSize);
        const metadataResult = await this.connection.metadata.read('RemoteSiteSetting', batch);
        const sites = Array.isArray(metadataResult) ? metadataResult : [metadataResult];
        for (const site of sites as RemoteSiteMetadata[]) {
          if (!site || !site.fullName) continue;
          const isActive = site.isActive !== false && String(site.isActive) !== 'false';
          if (!isActive) continue;
          activeCount++;
          const url = site.url || '';
          if (site.disableProtocolSecurity === true || String(site.disableProtocolSecurity) === 'true') insecureSites.push(`${site.fullName} (${url})`);
          if (url.startsWith('http://')) httpSites.push(`${site.fullName} (${url})`);
        }
      }
      if (insecureSites.length > 0) this.addFinding({ category: 'Integration Security', severity: 'high', title: 'Remote Sites with Disabled Protocol Security', description: 'Some remote sites have protocol security disabled.', affectedItems: insecureSites, recommendation: 'Enable protocol security for all remote sites.' });
      if (httpSites.length > 0) this.addFinding({ category: 'Integration Security', severity: 'medium', title: 'Remote Sites Using HTTP', description: 'Some remote sites use unencrypted HTTP connections.', affectedItems: httpSites, recommendation: 'Update remote sites to use HTTPS endpoints.' });
      this.log(`  ✓ Checked ${activeCount} active remote sites`);
    } catch (error) {
      this.warn(`  ⚠ Could not audit remote sites: ${(error as Error).message}`);
    }
  }

  private async auditConnectedApps(): Promise<void> {
    this.log('\n🔍 Auditing Connected Apps...');
    try {
      const connectedApps = await this.connection.query<ConnectedAppInfo>(`SELECT Id, Name, OptionsAllowAdminApprovedUsersOnly FROM ConnectedApplication`);
      const openApps: string[] = [];
      for (const app of connectedApps.records) {
        if (!app.OptionsAllowAdminApprovedUsersOnly) openApps.push(app.Name);
      }
      if (openApps.length > 0) this.addFinding({ category: 'Integration Security', severity: 'medium', title: 'Connected Apps Allowing All Users', description: 'Some connected apps allow all users rather than admin-approved only.', affectedItems: openApps, recommendation: 'Enable "Admin approved users are pre-authorized" for sensitive integrations.', reference: 'https://help.salesforce.com/s/articleView?id=sf.connected_app_manage.htm' });
      this.log(`  ✓ Checked ${connectedApps.records.length} connected apps`);
    } catch (error) {
      this.warn(`  ⚠ Could not audit connected apps: ${(error as Error).message}`);
    }
  }

  private async auditTrustedUrls(): Promise<void> {
    this.log('\n🔍 Auditing Trusted URLs (CSP)...');
    try {
      const listResult = await this.connection.metadata.list([{ type: 'CspTrustedSite' }]);
      if (!listResult || (Array.isArray(listResult) && listResult.length === 0)) { this.log('  ✓ No CSP trusted sites configured'); return; }
      const siteList = Array.isArray(listResult) ? listResult : [listResult];
      const siteNames = siteList.map((s) => s.fullName);
      this.trustedUrls = [];
      const wildcardUrls: string[] = [];
      const allContextUrls: string[] = [];
      let activeCount = 0;
      const batchSize = 10;
      for (let i = 0; i < siteNames.length; i += batchSize) {
        const batch = siteNames.slice(i, i + batchSize);
        const metadataResult = await this.connection.metadata.read('CspTrustedSite', batch);
        const sites = Array.isArray(metadataResult) ? metadataResult : [metadataResult];
        for (const site of sites as CspTrustedSiteMetadata[]) {
          if (!site || !site.fullName) continue;
          const isActive = site.isActive !== false && String(site.isActive) !== 'false';
          const url = site.endpointUrl || '';
          const context = site.context || 'All';
          this.trustedUrls.push({ name: site.fullName, url, context, isActive });
          if (!isActive) continue;
          activeCount++;
          if (url.includes('*')) wildcardUrls.push(`${site.fullName} (${url})`);
          if (context === 'All') allContextUrls.push(`${site.fullName} (${url})`);
        }
      }
      this.trustedUrls.sort((a, b) => a.name.localeCompare(b.name));
      if (wildcardUrls.length > 0) this.addFinding({ category: 'Integration Security', severity: 'high', title: 'CSP Trusted Sites with Wildcard URLs', description: 'Some CSP trusted sites use wildcard URLs which can be overly permissive.', affectedItems: wildcardUrls, recommendation: 'Replace wildcard URLs with specific domain URLs where possible.', reference: 'https://help.salesforce.com/s/articleView?id=sf.csp_trusted_sites.htm' });
      if (allContextUrls.length > 3) this.addFinding({ category: 'Integration Security', severity: 'medium', title: 'Many CSP Trusted Sites with "All" Context', description: `${allContextUrls.length} CSP trusted sites are configured with "All" context.`, affectedItems: allContextUrls, recommendation: 'Consider restricting context to specific directives where possible.', reference: 'https://help.salesforce.com/s/articleView?id=sf.csp_trusted_sites.htm' });
      this.log(`  ✓ Checked ${activeCount} active CSP trusted sites`);
    } catch (error) {
      this.warn(`  ⚠ Could not audit trusted URLs: ${(error as Error).message}`);
    }
  }

  private async auditMonitoringAndLogging(): Promise<void> {
    this.log('\n🔍 Auditing Monitoring & Logging...');
    await this.auditFieldHistoryTracking();
    await this.auditApiUsage();
    await this.auditDebugLogs();
    await this.auditLoginHistory();
    await this.auditEventMonitoring();
  }

  private async auditFieldHistoryTracking(): Promise<void> {
    this.log('  🔍 Checking Field History Tracking...');
    try {
      // Query objects that are customizable and check if they have history tracking enabled
      const objectsResult = await this.connection.query<{
        Id: string;
        DeveloperName: string;
        QualifiedApiName: string;
        IsCustomSetting: boolean;
      }>(`SELECT Id, DeveloperName, QualifiedApiName, IsCustomSetting FROM EntityDefinition WHERE IsCustomizable = true AND IsCustomSetting = false LIMIT 500`);

      const objectsWithoutHistory: string[] = [];
      const importantStandardObjects = ['Account', 'Contact', 'Opportunity', 'Lead', 'Case', 'Contract', 'Order', 'Quote', 'Asset', 'Campaign'];
      
      // Check which objects have history tracking by looking for History objects
      const historyObjectsResult = await this.connection.query<{ QualifiedApiName: string }>(`SELECT QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName LIKE '%History' OR QualifiedApiName LIKE '%__History' LIMIT 1000`);
      const historyObjectNames = new Set(historyObjectsResult.records.map((r) => r.QualifiedApiName.replace('History', '').replace('__', '')));

      for (const obj of objectsResult.records) {
        const objName = obj.QualifiedApiName;
        // Check if this is an important object without history tracking
        const hasHistory = historyObjectNames.has(objName) || historyObjectNames.has(obj.DeveloperName);
        
        // Focus on custom objects and important standard objects
        if (!hasHistory) {
          if (objName.endsWith('__c')) {
            objectsWithoutHistory.push(`${objName} (Custom Object)`);
          } else if (importantStandardObjects.includes(objName)) {
            objectsWithoutHistory.push(`${objName} (Standard Object)`);
          }
        }
      }

      if (objectsWithoutHistory.length > 0) {
        this.addFinding({
          category: 'Monitoring & Logging',
          severity: 'medium',
          title: 'Objects Without Field History Tracking',
          description: `${objectsWithoutHistory.length} objects do not have field history tracking enabled. Field history tracking is important for audit trails and compliance.`,
          affectedItems: objectsWithoutHistory.slice(0, 50),
          recommendation: 'Enable field history tracking for objects that contain sensitive or business-critical data. Navigate to Setup > Object Manager > [Object] > Fields & Relationships > Set History Tracking.',
          reference: 'https://help.salesforce.com/s/articleView?id=sf.tracking_field_history.htm',
        });
      }

      this.log(`    ✓ Checked ${objectsResult.records.length} objects for history tracking`);
    } catch (error) {
      this.warn(`    ⚠ Could not audit field history tracking: ${(error as Error).message}`);
    }
  }

  private async auditApiUsage(): Promise<void> {
    this.log('  🔍 Analyzing API Usage...');
    try {
      // Get API limits using REST API
      const limitsUrl = `${this.connection.instanceUrl}/services/data/v${this.connection.version}/limits`;
      const limitsResponse = await this.connection.request<Record<string, { Max: number; Remaining: number }>>({ url: limitsUrl, method: 'GET' });

      const apiFindings: string[] = [];
      const apiWarnings: string[] = [];

      // Check Daily API Requests
      if (limitsResponse.DailyApiRequests) {
        const used = limitsResponse.DailyApiRequests.Max - limitsResponse.DailyApiRequests.Remaining;
        const usagePercent = (used / limitsResponse.DailyApiRequests.Max) * 100;
        apiFindings.push(`Daily API Requests: ${used.toLocaleString()} / ${limitsResponse.DailyApiRequests.Max.toLocaleString()} (${usagePercent.toFixed(1)}% used)`);
        if (usagePercent > 80) {
          apiWarnings.push(`Daily API Requests at ${usagePercent.toFixed(1)}% - approaching limit`);
        }
      }

      // Check Bulk API Requests
      if (limitsResponse.DailyBulkApiRequests) {
        const used = limitsResponse.DailyBulkApiRequests.Max - limitsResponse.DailyBulkApiRequests.Remaining;
        const usagePercent = (used / limitsResponse.DailyBulkApiRequests.Max) * 100;
        apiFindings.push(`Daily Bulk API Requests: ${used.toLocaleString()} / ${limitsResponse.DailyBulkApiRequests.Max.toLocaleString()} (${usagePercent.toFixed(1)}% used)`);
        if (usagePercent > 80) {
          apiWarnings.push(`Daily Bulk API Requests at ${usagePercent.toFixed(1)}% - approaching limit`);
        }
      }

      // Check Streaming API
      if (limitsResponse.DailyStreamingApiEvents) {
        const used = limitsResponse.DailyStreamingApiEvents.Max - limitsResponse.DailyStreamingApiEvents.Remaining;
        const usagePercent = limitsResponse.DailyStreamingApiEvents.Max > 0 ? (used / limitsResponse.DailyStreamingApiEvents.Max) * 100 : 0;
        apiFindings.push(`Daily Streaming API Events: ${used.toLocaleString()} / ${limitsResponse.DailyStreamingApiEvents.Max.toLocaleString()} (${usagePercent.toFixed(1)}% used)`);
        if (usagePercent > 80) {
          apiWarnings.push(`Daily Streaming API Events at ${usagePercent.toFixed(1)}% - approaching limit`);
        }
      }

      // Check Async Apex Executions
      if (limitsResponse.DailyAsyncApexExecutions) {
        const used = limitsResponse.DailyAsyncApexExecutions.Max - limitsResponse.DailyAsyncApexExecutions.Remaining;
        const usagePercent = (used / limitsResponse.DailyAsyncApexExecutions.Max) * 100;
        apiFindings.push(`Daily Async Apex Executions: ${used.toLocaleString()} / ${limitsResponse.DailyAsyncApexExecutions.Max.toLocaleString()} (${usagePercent.toFixed(1)}% used)`);
        if (usagePercent > 80) {
          apiWarnings.push(`Daily Async Apex Executions at ${usagePercent.toFixed(1)}% - approaching limit`);
        }
      }

      // Check Data Storage
      if (limitsResponse.DataStorageMB) {
        const used = limitsResponse.DataStorageMB.Max - limitsResponse.DataStorageMB.Remaining;
        const usagePercent = (used / limitsResponse.DataStorageMB.Max) * 100;
        apiFindings.push(`Data Storage: ${used.toLocaleString()} MB / ${limitsResponse.DataStorageMB.Max.toLocaleString()} MB (${usagePercent.toFixed(1)}% used)`);
        if (usagePercent > 90) {
          apiWarnings.push(`Data Storage at ${usagePercent.toFixed(1)}% - critical level`);
        }
      }

      // Check File Storage
      if (limitsResponse.FileStorageMB) {
        const used = limitsResponse.FileStorageMB.Max - limitsResponse.FileStorageMB.Remaining;
        const usagePercent = (used / limitsResponse.FileStorageMB.Max) * 100;
        apiFindings.push(`File Storage: ${used.toLocaleString()} MB / ${limitsResponse.FileStorageMB.Max.toLocaleString()} MB (${usagePercent.toFixed(1)}% used)`);
        if (usagePercent > 90) {
          apiWarnings.push(`File Storage at ${usagePercent.toFixed(1)}% - critical level`);
        }
      }

      // Add informational finding about API usage
      this.addFinding({
        category: 'Monitoring & Logging',
        severity: apiWarnings.length > 0 ? 'high' : 'low',
        title: 'API Usage Analysis',
        description: apiWarnings.length > 0 
          ? `API usage analysis detected ${apiWarnings.length} potential concerns. High API usage can indicate integration issues or inefficient processes.`
          : 'API usage analysis completed. Current usage levels are within acceptable limits.',
        affectedItems: apiWarnings.length > 0 ? [...apiWarnings, '---', ...apiFindings] : apiFindings,
        recommendation: apiWarnings.length > 0 
          ? 'Review integration patterns and optimize API calls. Consider implementing caching, batch processing, or composite API calls to reduce usage.'
          : 'Continue monitoring API usage regularly. Set up alerts for when usage exceeds 70% of limits.',
        reference: 'https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_api.htm',
      });

      // Query for high API consumers (Connected Apps with recent activity)
      try {
        const connectedAppsResult = await this.connection.query<{ Name: string; Id: string }>(`SELECT Id, Name FROM ConnectedApplication LIMIT 50`);
        if (connectedAppsResult.records.length > 10) {
          this.addFinding({
            category: 'Monitoring & Logging',
            severity: 'low',
            title: 'Multiple Connected Apps Detected',
            description: `${connectedAppsResult.records.length} connected apps are configured. Each may consume API calls.`,
            affectedItems: connectedAppsResult.records.map((app) => app.Name),
            recommendation: 'Review connected apps periodically and remove unused integrations to reduce API consumption and security exposure.',
            reference: 'https://help.salesforce.com/s/articleView?id=sf.connected_app_overview.htm',
          });
        }
      } catch { /* Connected apps query may fail in some orgs */ }

      this.log(`    ✓ Analyzed API usage and limits`);
    } catch (error) {
      this.warn(`    ⚠ Could not analyze API usage: ${(error as Error).message}`);
    }
  }

  private async auditDebugLogs(): Promise<void> {
    this.log('  🔍 Checking Debug Log Configuration...');
    try {
      // Check for active trace flags (debug logs)
      const traceFlagsResult = await this.connection.query<{
        Id: string;
        TracedEntityId: string;
        LogType: string;
        StartDate: string;
        ExpirationDate: string;
        DebugLevel: { DeveloperName: string };
      }>(`SELECT Id, TracedEntityId, LogType, StartDate, ExpirationDate, DebugLevel.DeveloperName FROM TraceFlag WHERE ExpirationDate > TODAY LIMIT 100`);

      if (traceFlagsResult.records.length > 0) {
        const activeTraceFlags = traceFlagsResult.records.map((tf) => 
          `${tf.LogType} - Level: ${tf.DebugLevel?.DeveloperName || 'Unknown'} (Expires: ${new Date(tf.ExpirationDate).toLocaleDateString()})`
        );

        this.addFinding({
          category: 'Monitoring & Logging',
          severity: traceFlagsResult.records.length > 5 ? 'medium' : 'low',
          title: 'Active Debug Logs Detected',
          description: `${traceFlagsResult.records.length} active debug log trace flags found. Debug logs can impact performance and may expose sensitive data.`,
          affectedItems: activeTraceFlags,
          recommendation: 'Review active debug logs and disable those that are no longer needed. Avoid leaving debug logs enabled in production for extended periods.',
          reference: 'https://help.salesforce.com/s/articleView?id=sf.code_setting_debug_log_levels.htm',
        });
      }

      // Check for debug log retention
      const debugLogsResult = await this.connection.query<{ Id: string }>(`SELECT Id FROM ApexLog LIMIT 1`);
      if (debugLogsResult.records.length > 0) {
        this.log(`    ✓ Debug logs are being captured`);
      }

      this.log(`    ✓ Checked debug log configuration`);
    } catch (error) {
      this.warn(`    ⚠ Could not audit debug logs: ${(error as Error).message}`);
    }
  }

  private async auditLoginHistory(): Promise<void> {
    this.log('  🔍 Analyzing Login History...');
    try {
      // Check for suspicious login patterns in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateFilter = sevenDaysAgo.toISOString();

      // Query login history for failed logins
      const failedLoginsResult = await this.connection.query<{
        UserId: string;
        LoginTime: string;
        Status: string;
        SourceIp: string;
        LoginType: string;
        User: { Username: string };
      }>(`SELECT UserId, LoginTime, Status, SourceIp, LoginType, User.Username FROM LoginHistory WHERE LoginTime > ${dateFilter} AND Status != 'Success' LIMIT 200`);

      if (failedLoginsResult.records.length > 0) {
        // Group by user
        const failedByUser: Record<string, number> = {};
        for (const login of failedLoginsResult.records) {
          const username = login.User?.Username || 'Unknown';
          failedByUser[username] = (failedByUser[username] || 0) + 1;
        }

        const usersWithManyFailures = Object.entries(failedByUser)
          .filter(([, count]) => count >= 3)
          .map(([user, count]) => `${user}: ${count} failed attempts`);

        if (usersWithManyFailures.length > 0) {
          this.addFinding({
            category: 'Monitoring & Logging',
            severity: 'high',
            title: 'Multiple Failed Login Attempts Detected',
            description: `${usersWithManyFailures.length} users have had multiple failed login attempts in the last 7 days. This could indicate brute force attacks or credential issues.`,
            affectedItems: usersWithManyFailures,
            recommendation: 'Investigate users with multiple failed logins. Consider enabling MFA, reviewing password policies, and checking for potential security threats.',
            reference: 'https://help.salesforce.com/s/articleView?id=sf.security_login_history.htm',
          });
        }
      }

      // Check for logins from unusual locations (multiple IPs per user)
      const loginIpsResult = await this.connection.query<{
        UserId: string;
        SourceIp: string;
        User: { Username: string };
      }>(`SELECT UserId, SourceIp, User.Username FROM LoginHistory WHERE LoginTime > ${dateFilter} AND Status = 'Success' LIMIT 500`);

      const ipsByUser: Record<string, Set<string>> = {};
      for (const login of loginIpsResult.records) {
        const username = login.User?.Username || 'Unknown';
        if (!ipsByUser[username]) ipsByUser[username] = new Set();
        ipsByUser[username].add(login.SourceIp);
      }

      const usersWithManyIps = Object.entries(ipsByUser)
        .filter(([, ips]) => ips.size >= 5)
        .map(([user, ips]) => `${user}: ${ips.size} different IP addresses`);

      if (usersWithManyIps.length > 0) {
        this.addFinding({
          category: 'Monitoring & Logging',
          severity: 'medium',
          title: 'Users Logging In From Multiple IP Addresses',
          description: `${usersWithManyIps.length} users have logged in from 5 or more different IP addresses in the last 7 days. This could indicate shared credentials or VPN usage.`,
          affectedItems: usersWithManyIps,
          recommendation: 'Review login patterns for these users. Consider enabling "Lock sessions to the IP address from which they originated" in Session Settings.',
          reference: 'https://help.salesforce.com/s/articleView?id=sf.admin_sessions.htm',
        });
      }

      this.log(`    ✓ Analyzed login history`);
    } catch (error) {
      this.warn(`    ⚠ Could not analyze login history: ${(error as Error).message}`);
    }
  }

  private async auditEventMonitoring(): Promise<void> {
    this.log('  🔍 Checking Event Monitoring Setup...');
    try {
      // Check if Event Monitoring is available (Shield feature)
      const eventLogResult = await this.connection.query<{ Id: string; EventType: string; LogDate: string }>(`SELECT Id, EventType, LogDate FROM EventLogFile ORDER BY LogDate DESC LIMIT 10`);

      if (eventLogResult.records.length > 0) {
        const eventTypes = [...new Set(eventLogResult.records.map((e) => e.EventType))];
        this.addFinding({
          category: 'Monitoring & Logging',
          severity: 'low',
          title: 'Event Monitoring Enabled',
          description: `Event Monitoring is active with ${eventTypes.length} event types being captured. This is a positive security control.`,
          affectedItems: eventTypes.map((t) => `Event Type: ${t}`),
          recommendation: 'Continue using Event Monitoring. Consider setting up Event Monitoring Analytics for proactive threat detection.',
          reference: 'https://help.salesforce.com/s/articleView?id=sf.event_monitoring.htm',
        });
      } else {
        this.addFinding({
          category: 'Monitoring & Logging',
          severity: 'medium',
          title: 'Event Monitoring Not Detected',
          description: 'Event Monitoring (Salesforce Shield) does not appear to be enabled or has no recent events. Event Monitoring provides detailed audit trails for security analysis.',
          affectedItems: ['No EventLogFile records found'],
          recommendation: 'Consider enabling Salesforce Shield Event Monitoring for enhanced security visibility and compliance. This is especially important for orgs handling sensitive data.',
          reference: 'https://help.salesforce.com/s/articleView?id=sf.event_monitoring.htm',
        });
      }

      // Check for Transaction Security Policies (if available)
      try {
        const transactionPoliciesResult = await this.connection.query<{ Id: string; DeveloperName: string; State: string }>(`SELECT Id, DeveloperName, State FROM TransactionSecurityPolicy LIMIT 50`);
        
        if (transactionPoliciesResult.records.length > 0) {
          const activePolicies = transactionPoliciesResult.records.filter((p) => p.State === 'Enabled');
          const inactivePolicies = transactionPoliciesResult.records.filter((p) => p.State !== 'Enabled');
          
          if (inactivePolicies.length > 0) {
            this.addFinding({
              category: 'Monitoring & Logging',
              severity: 'low',
              title: 'Inactive Transaction Security Policies',
              description: `${inactivePolicies.length} transaction security policies are configured but not enabled.`,
              affectedItems: inactivePolicies.map((p) => `${p.DeveloperName} (${p.State})`),
              recommendation: 'Review inactive transaction security policies and enable those that are needed for security monitoring.',
              reference: 'https://help.salesforce.com/s/articleView?id=sf.enhanced_transaction_security_policy_types.htm',
            });
          }
          
          if (activePolicies.length > 0) {
            this.log(`    ✓ Found ${activePolicies.length} active transaction security policies`);
          }
        }
      } catch { /* Transaction Security may not be available in all orgs */ }

      this.log(`    ✓ Checked event monitoring setup`);
    } catch (error) {
      // EventLogFile query may fail if Shield is not enabled
      this.addFinding({
        category: 'Monitoring & Logging',
        severity: 'medium',
        title: 'Event Monitoring Not Available',
        description: 'Event Monitoring (Salesforce Shield) is not available in this org. Event Monitoring provides detailed audit trails for security analysis.',
        affectedItems: ['EventLogFile object not accessible'],
        recommendation: 'Consider enabling Salesforce Shield Event Monitoring for enhanced security visibility and compliance.',
        reference: 'https://help.salesforce.com/s/articleView?id=sf.event_monitoring.htm',
      });
      this.log(`    ⚠ Event Monitoring not available: ${(error as Error).message}`);
    }
  }

  private addFinding(finding: Omit<SecurityFinding, 'id'>): void {
    this.findingCounter++;
    this.findings.push({ id: String(this.findingCounter), ...finding });
  }

  private generateSummary(categories: string[]): AuditSummary {
    return {
      totalFindings: this.findings.length,
      critical: this.findings.filter((f) => f.severity === 'critical').length,
      high: this.findings.filter((f) => f.severity === 'high').length,
      medium: this.findings.filter((f) => f.severity === 'medium').length,
      low: this.findings.filter((f) => f.severity === 'low').length,
      categoriesAudited: categories,
      auditDate: new Date().toISOString(),
      orgId: this.orgInfo.orgId,
      orgName: this.orgInfo.orgName,
      username: this.orgInfo.username,
      instanceUrl: this.orgInfo.instanceUrl,
    };
  }

  private generateReport(summary: AuditSummary, format: string, includeRecommendations: boolean): string {
    if (format === 'json') return JSON.stringify({ summary, findings: this.findings, sharingSettings: { owdSettings: this.owdSettings, sharingConfig: this.sharingSettings } }, null, 2);
    if (format === 'html') return this.generateHtmlReport(summary, includeRecommendations);
    return this.generateMarkdownReport(summary, includeRecommendations);
  }

  private generateHtmlReport(summary: AuditSummary, includeRecommendations: boolean): string {
    const findingsJson = JSON.stringify(this.findings);
    const unsecuredOwdSettings = this.owdSettings.filter((o) => o.externalAccess === 'Read' || o.externalAccess === 'ReadWrite');
    const tabOrder = ['User Access & Authentication Review', 'Data Access Security', 'Apex & Code Security', 'Integration Security', 'Platform Security Configuration', 'Sensitive Data Protection', 'Monitoring & Logging', 'Declarative Security', 'Lightning Component Security'];
    const findingsByCategory: Record<string, SecurityFinding[]> = {};
    for (const finding of this.findings) {
      if (!findingsByCategory[finding.category]) findingsByCategory[finding.category] = [];
      findingsByCategory[finding.category].push(finding);
    }
    
    // Build Objects with Unsecured External Access table HTML (replaces affected items for OWD findings)
    const owdTableHtml = unsecuredOwdSettings.length > 0 ? `<div class="sharing-section" style="margin-top:32px;padding-top:24px;border-top:2px solid var(--border)"><h3 style="margin-bottom:16px">Objects with Unsecured External Access (${unsecuredOwdSettings.length})</h3><p style="margin-bottom:16px;color:#666;font-size:13px">Only showing objects where external access is Read or ReadWrite (not Private).</p><table class="data-table"><thead><tr><th>Object</th><th>Internal Access</th><th>External Access</th></tr></thead><tbody>${unsecuredOwdSettings.map((o) => `<tr><td><strong>${o.developerName}</strong></td><td><span class="access-badge ${o.internalAccess.toLowerCase()}">${o.internalAccess}</span></td><td><span class="access-badge ${o.externalAccess.toLowerCase()}">${o.externalAccess}</span></td></tr>`).join('')}</tbody></table></div>` : '';
    
    // Check if Data Access Security has findings or OWD settings to show
    const hasDataAccessContent = (findingsByCategory['Data Access Security'] && findingsByCategory['Data Access Security'].length > 0) || unsecuredOwdSettings.length > 0;
    
    // Build tabs - include Data Access Security if it has content (findings or OWD settings)
    const tabsHtml = tabOrder.filter((cat) => {
      if (cat === 'Data Access Security') return hasDataAccessContent;
      return findingsByCategory[cat] && findingsByCategory[cat].length > 0;
    }).map((cat, idx) => {
      const count = findingsByCategory[cat]?.length || 0;
      return `<div class="tab${idx === 0 ? ' active' : ''}" onclick="showTab('${cat.replace(/[^a-zA-Z]/g, '')}')">${cat} (${count})</div>`;
    }).join('');
    
    // Build tab content
    const tabContentHtml = tabOrder.filter((cat) => {
      if (cat === 'Data Access Security') return hasDataAccessContent;
      return findingsByCategory[cat] && findingsByCategory[cat].length > 0;
    }).map((cat, idx) => {
      const catFindings = findingsByCategory[cat] || [];
      // For Data Access Security, filter out OWD-related findings since we show the table instead
      const owdFindingTitles = ['Many Objects with External Read Access', 'Objects with External ReadWrite Access', 'External OWD More Permissive Than Internal'];
      const filteredFindings = cat === 'Data Access Security' ? catFindings.filter((f) => !owdFindingTitles.includes(f.title)) : catFindings;
      
      const findingsHtml = filteredFindings.map((f, i) => `<div class="finding ${f.severity}" data-sev="${f.severity}"><div class="finding-header" onclick="toggleFinding('${cat.replace(/[^a-zA-Z]/g, '')}-${i}')"><div><div class="finding-title">${f.title}</div><div class="finding-category">${f.category}</div></div><div class="finding-actions"><span class="severity-badge ${f.severity}">${f.severity}</span></div></div><div class="finding-body" id="body-${cat.replace(/[^a-zA-Z]/g, '')}-${i}"><p>${f.description}</p><h4>Affected Items (${f.affectedItems.length})</h4><ul>${f.affectedItems.map((item) => `<li>${item}</li>`).join('')}</ul>${includeRecommendations ? `<div class="recommendation"><strong>Recommendation:</strong> ${f.recommendation}</div>` : ''}${f.reference ? `<p style="margin-top:12px;font-size:13px"><a href="${f.reference}" target="_blank">Learn more</a></p>` : ''}</div></div>`).join('');
      
      // Add OWD table to Data Access Security tab (replaces the affected items lists for OWD findings)
      const extraContent = cat === 'Data Access Security' ? owdTableHtml : '';
      
      return `<div id="${cat.replace(/[^a-zA-Z]/g, '')}-tab" class="tab-content${idx === 0 ? ' active' : ''}"><div class="findings-list">${findingsHtml}</div>${extraContent}</div>`;
    }).join('');
    
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Security Audit Report - ${summary.orgName || 'Salesforce Org'}</title><style>:root{--critical:#dc3545;--high:#fd7e14;--medium:#ffc107;--low:#28a745;--info:#17a2b8;--bg:#f4f6f9;--card:#fff;--text:#333;--border:#e0e0e0;--sidebar-width:320px}*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6}.layout{display:flex;min-height:100vh}.sidebar{width:var(--sidebar-width);background:linear-gradient(180deg,#1a1a2e 0%,#16213e 100%);color:#fff;padding:24px;position:fixed;height:100vh;overflow-y:auto}.sidebar h1{font-size:20px;margin-bottom:8px;display:flex;align-items:center;gap:10px}.org-info{background:rgba(255,255,255,0.1);border-radius:8px;padding:16px;margin:20px 0;font-size:13px}.org-info div{margin:6px 0;display:flex;justify-content:space-between}.org-info span{opacity:0.7}.org-info strong{color:#fff}.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px}.stat-card{background:rgba(255,255,255,0.1);border-radius:8px;padding:14px;text-align:center}.stat-value{font-size:28px;font-weight:700}.stat-label{font-size:11px;opacity:0.7;text-transform:uppercase}.stat-card.critical .stat-value{color:var(--critical)}.stat-card.high .stat-value{color:var(--high)}.stat-card.medium .stat-value{color:var(--medium)}.stat-card.low .stat-value{color:var(--low)}.main-content{margin-left:var(--sidebar-width);flex:1;padding:24px}.header{background:var(--card);border-radius:12px;padding:24px;margin-bottom:24px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}.header h2{font-size:24px;margin-bottom:8px}.header-meta{display:flex;gap:24px;color:#666;font-size:14px}.tabs{display:flex;gap:4px;margin-bottom:24px;background:var(--card);padding:6px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);flex-wrap:wrap}.tab{padding:10px 16px;border-radius:8px;cursor:pointer;font-weight:600;color:#666;transition:all 0.2s;font-size:12px}.tab:hover{background:#f8f9fa}.tab.active{background:var(--info);color:#fff}.tab-content{display:none}.tab-content.active{display:block}.findings-list{display:flex;flex-direction:column;gap:16px}.finding{background:var(--card);border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);transition:all 0.2s}.finding:hover{box-shadow:0 4px 16px rgba(0,0,0,0.1)}.finding-header{padding:20px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;border-left:4px solid transparent}.finding.critical .finding-header{border-left-color:var(--critical)}.finding.high .finding-header{border-left-color:var(--high)}.finding.medium .finding-header{border-left-color:var(--medium)}.finding.low .finding-header{border-left-color:var(--low)}.finding-title{font-weight:600;font-size:15px}.finding-category{color:#666;font-size:13px;margin-top:4px}.severity-badge{padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;color:#fff}.severity-badge.critical{background:var(--critical)}.severity-badge.high{background:var(--high)}.severity-badge.medium{background:var(--medium);color:#333}.severity-badge.low{background:var(--low)}.finding-body{padding:0 20px 20px;display:none;border-top:1px solid var(--border)}.finding-body.open{display:block;padding-top:20px}.finding-body p{margin-bottom:16px;color:#555}.finding-body h4{margin:16px 0 8px;color:#333;font-size:14px}.finding-body ul{margin-left:20px;color:#555}.finding-body li{margin:6px 0}.recommendation{background:#e7f5ff;border:1px solid #b3d9ff;border-radius:8px;padding:16px;margin-top:16px}.recommendation strong{color:#0066cc}.data-table{width:100%;border-collapse:collapse;margin-top:16px}.data-table th,.data-table td{padding:12px 16px;text-align:left;border-bottom:1px solid var(--border)}.data-table th{background:#f8f9fa;font-weight:600;font-size:13px;color:#555}.data-table tr:hover{background:#f8f9fa}.access-badge{padding:4px 10px;border-radius:4px;font-size:11px;font-weight:600}.access-badge.private{background:#d4edda;color:#155724}.access-badge.read{background:#d1ecf1;color:#0c5460}.access-badge.readwrite{background:#fff3cd;color:#856404}.sharing-section{background:var(--card);border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}.footer{text-align:center;padding:24px;color:#666;font-size:13px}@media(max-width:1024px){.sidebar{width:100%;height:auto;position:relative}.layout{flex-direction:column}.main-content{margin-left:0}}</style></head><body><div class="layout"><aside class="sidebar"><h1>Security Audit</h1><div class="org-info"><div><span>Organization</span><strong>${summary.orgName || 'N/A'}</strong></div><div><span>Org ID</span><strong>${summary.orgId?.substring(0, 15) || 'N/A'}</strong></div><div><span>Username</span><strong>${summary.username || 'N/A'}</strong></div><div><span>Instance</span><strong>${summary.instanceUrl?.replace('https://', '') || 'N/A'}</strong></div></div><div class="stats-grid"><div class="stat-card critical"><div class="stat-value">${summary.critical}</div><div class="stat-label">Critical</div></div><div class="stat-card high"><div class="stat-value">${summary.high}</div><div class="stat-label">High</div></div><div class="stat-card medium"><div class="stat-value">${summary.medium}</div><div class="stat-label">Medium</div></div><div class="stat-card low"><div class="stat-value">${summary.low}</div><div class="stat-label">Low</div></div></div></aside><main class="main-content"><div class="header"><h2>Security Audit Report</h2><div class="header-meta"><span>${new Date(summary.auditDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span><span>${summary.totalFindings} findings</span><span>${summary.categoriesAudited.length} categories audited</span></div></div><div class="tabs">${tabsHtml}</div>${tabContentHtml}<div class="footer">Generated by DXB CLI - Security Audit Tool</div></main></div><script>const findings=${findingsJson};function toggleFinding(id){document.getElementById('body-'+id).classList.toggle('open')}function showTab(t){document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));const tab=document.getElementById(t+'-tab');if(tab)tab.classList.add('active');event.target.classList.add('active')}</script></body></html>`;
  }

  private generateMarkdownReport(summary: AuditSummary, includeRecommendations: boolean): string {
    const severityEmoji: Record<Severity, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
    let md = `# Security Audit Report\n\n**Organization:** ${summary.orgName || 'N/A'}  \n**Generated:** ${summary.auditDate}  \n**Categories:** ${summary.categoriesAudited.join(', ')}\n\n---\n\n## Summary\n\n| Severity | Count |\n|----------|-------|\n| Critical | ${summary.critical} |\n| High | ${summary.high} |\n| Medium | ${summary.medium} |\n| Low | ${summary.low} |\n| **Total** | **${summary.totalFindings}** |\n\n---\n\n## Findings\n\n`;
    if (this.findings.length === 0) { md += '**No security findings detected!**\n\n'; }
    else {
      const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low'];
      for (const severity of severityOrder) {
        const severityFindings = this.findings.filter((f) => f.severity === severity);
        if (severityFindings.length === 0) continue;
        md += `### ${severityEmoji[severity]} ${severity.charAt(0).toUpperCase() + severity.slice(1)}\n\n`;
        for (const finding of severityFindings) {
          md += `#### ${finding.title}\n\n**Category:** ${finding.category}\n\n${finding.description}\n\n**Affected Items:**\n`;
          for (const item of finding.affectedItems) { md += `- ${item}\n`; }
          if (includeRecommendations) { md += `\n> **Recommendation:** ${finding.recommendation}\n`; }
          if (finding.reference) { md += `\n[Learn more](${finding.reference})\n`; }
          md += '\n---\n\n';
        }
      }
    }
    const unsecuredOwdSettings = this.owdSettings.filter((o) => o.externalAccess === 'Read' || o.externalAccess === 'ReadWrite');
    if (unsecuredOwdSettings.length > 0) {
      md += `## Sharing Settings\n\n| Object | Internal | External |\n|--------|----------|----------|\n`;
      for (const owd of unsecuredOwdSettings.slice(0, 50)) { md += `| ${owd.developerName} | ${owd.internalAccess} | ${owd.externalAccess} |\n`; }
      if (unsecuredOwdSettings.length > 50) md += `\n*...and ${unsecuredOwdSettings.length - 50} more*\n`;
      md += '\n';
    }
    md += '*Generated by DXB CLI - Security Audit Tool*\n';
    return md;
  }
}
//__________________________GenAI: Generated code ends here______________________________//
