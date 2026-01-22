import * as path from 'path';
import * as fs from 'fs-extra';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Connection, Messages, Org } from '@salesforce/core';
import * as Handlebars from 'handlebars';

export type SecurityAuditResult = {
  reportPath?: string;
  acceptedFindingsPath?: string;
  findings: SecurityFinding[];
  summary: AuditSummary;
  success: boolean;
};

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

interface RemoteSiteInfo {
  Id: string;
  SiteName: string;
  EndpointUrl: string;
  IsActive: boolean;
  DisableProtocolSecurity: boolean;
}

interface ConnectedAppInfo {
  Id: string;
  Name: string;
  OptionsAllowAdminApprovedUsersOnly: boolean;
}

const VALID_CATEGORIES = [
  'profiles',
  'permissions',
  'fields',
  'sharing',
  'external-owd',
  'guest-user',
  'session',
  'password',
  'apex',
  'remote-sites',
  'connected-apps',
];

const SENSITIVE_FIELD_PATTERNS = [
  /ssn/i,
  /social.*security/i,
  /credit.*card/i,
  /card.*number/i,
  /cvv/i,
  /password/i,
  /secret/i,
  /token/i,
  /api.*key/i,
  /private.*key/i,
  /bank.*account/i,
  /routing.*number/i,
  /tax.*id/i,
  /driver.*license/i,
  /passport/i,
  /national.*id/i,
];

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'security.audit');

export default class SecurityAudit extends SfCommand<SecurityAuditResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.string({
      char: 'o',
      summary: messages.getMessage('flags.target-org.summary'),
      required: true,
    }),
    categories: Flags.string({
      char: 'c',
      summary: messages.getMessage('flags.categories.summary'),
      default: VALID_CATEGORIES.join(','),
    }),
    format: Flags.string({
      char: 'r',
      summary: messages.getMessage('flags.format.summary'),
      options: ['html', 'markdown', 'json'],
      default: 'html',
    }),
    'output-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.output-dir.summary'),
    }),
    'severity-threshold': Flags.string({
      char: 's',
      summary: messages.getMessage('flags.severity-threshold.summary'),
      options: ['critical', 'high', 'medium', 'low'],
    }),
    'include-recommendations': Flags.boolean({
      char: 'i',
      summary: messages.getMessage('flags.include-recommendations.summary'),
      default: true,
    }),
    'source-path': Flags.directory({
      char: 'p',
      summary: messages.getMessage('flags.source-path.summary'),
      default: 'force-app/main/default',
    }),
  };

  private connection!: Connection;
  private findings: SecurityFinding[] = [];

  public async run(): Promise<SecurityAuditResult> {
    const { flags } = await this.parse(SecurityAudit);

    // Validate categories
    const categories = flags.categories.split(',').map((c) => c.trim().toLowerCase());
    for (const category of categories) {
      if (!VALID_CATEGORIES.includes(category)) {
        throw messages.createError('error.invalidCategory', [category]);
      }
    }

    // Connect to org
    const org: Org = await Org.create({ aliasOrUsername: flags['target-org'] });
    this.connection = org.getConnection();

    this.log(`Starting security audit for org: ${flags['target-org']}`);
    this.log(`Categories: ${categories.join(', ')}`);

    // Run audits based on selected categories
    if (categories.includes('profiles')) {
      await this.auditProfiles();
    }
    if (categories.includes('permissions')) {
      await this.auditPermissionSets();
    }
    if (categories.includes('fields')) {
      await this.auditFieldLevelSecurity();
    }
    if (categories.includes('sharing')) {
      await this.auditSharingRules();
    }
    if (categories.includes('external-owd')) {
      await this.auditExternalOWD();
    }
    if (categories.includes('guest-user')) {
      await this.auditGuestUserAccess();
    }
    if (categories.includes('session')) {
      await this.auditSessionSettings();
    }
    if (categories.includes('password')) {
      await this.auditPasswordPolicies();
    }
    if (categories.includes('apex')) {
      await this.auditApexSecurity(flags['source-path']);
    }
    if (categories.includes('remote-sites')) {
      await this.auditRemoteSites();
    }
    if (categories.includes('connected-apps')) {
      await this.auditConnectedApps();
    }

    // Generate summary
    const summary = this.generateSummary(categories);

    // Check severity threshold
    if (flags['severity-threshold']) {
      const threshold = flags['severity-threshold'] as Severity;
      const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low'];
      const thresholdIndex = severityOrder.indexOf(threshold);
      const findingsAboveThreshold = this.findings.filter(
        (f) => severityOrder.indexOf(f.severity) <= thresholdIndex
      );

      if (findingsAboveThreshold.length > 0) {
        this.warn(
          `Found ${findingsAboveThreshold.length} findings at or above ${threshold} severity`
        );
      }
    }

    // Output report
    if (flags['output-dir']) {
      // Generate report with fixed file names (no timestamp)
      const report = this.generateReport(summary, flags.format, flags['include-recommendations']);
      const fileName = `security-audit.${flags.format === 'json' ? 'json' : flags.format === 'html' ? 'html' : 'md'}`;
      const reportPath = path.join(flags['output-dir'], fileName);
      fs.ensureDirSync(flags['output-dir']);
      fs.writeFileSync(reportPath, report);
      this.log(`\nReport generated: ${reportPath}`);

      // Create the accepted findings JSON file for HTML reports (only if it doesn't exist)
      let acceptedFindingsPath: string | undefined;
      if (flags.format === 'html') {
        const acceptedFileName = 'security-audit-accepted.json';
        acceptedFindingsPath = path.join(flags['output-dir'], acceptedFileName);
        
        // Only create if it doesn't exist - preserve existing accepted findings
        if (!fs.existsSync(acceptedFindingsPath)) {
          const initialAcceptedData = {
            createdDate: new Date().toISOString(),
            acceptedFindings: {},
          };
          fs.writeFileSync(acceptedFindingsPath, JSON.stringify(initialAcceptedData, null, 2));
          this.log(`Accepted findings file created: ${acceptedFindingsPath}`);
        } else {
          this.log(`Accepted findings file exists: ${acceptedFindingsPath}`);
        }
      }

      // Check threshold and exit with error if exceeded
      if (flags['severity-threshold']) {
        const threshold = flags['severity-threshold'] as Severity;
        const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low'];
        const thresholdIndex = severityOrder.indexOf(threshold);
        const findingsAboveThreshold = this.findings.filter(
          (f) => severityOrder.indexOf(f.severity) <= thresholdIndex
        );

        if (findingsAboveThreshold.length > 0) {
          throw messages.createError('error.thresholdExceeded', [
            findingsAboveThreshold.length.toString(),
            threshold,
          ]);
        }
      }

      return { reportPath, acceptedFindingsPath, findings: this.findings, summary, success: true };
    } else {
      // Generate report without timestamp (for console output)
      const report = this.generateReport(summary, flags.format, flags['include-recommendations']);
      this.log(report);
      return { findings: this.findings, summary, success: true };
    }
  }

  private async auditProfiles(): Promise<void> {
    this.log('\n🔍 Auditing Profiles...');

    try {
      const profiles = await this.connection.query<ProfileInfo>(`
        SELECT Id, Name, PermissionsModifyAllData, PermissionsViewAllData, 
               PermissionsAuthorApex, PermissionsManageUsers, PermissionsApiEnabled,
               PermissionsViewSetup, PermissionsManageDataIntegrations
        FROM Profile
        WHERE UserType = 'Standard'
      `);

      const dangerousProfiles: string[] = [];
      const apiEnabledProfiles: string[] = [];

      for (const profile of profiles.records) {
        // Check for dangerous permissions
        if (profile.PermissionsModifyAllData && profile.Name !== 'System Administrator') {
          dangerousProfiles.push(`${profile.Name} (ModifyAllData)`);
        }
        if (profile.PermissionsViewAllData && profile.Name !== 'System Administrator') {
          dangerousProfiles.push(`${profile.Name} (ViewAllData)`);
        }
        if (profile.PermissionsAuthorApex && profile.Name !== 'System Administrator') {
          dangerousProfiles.push(`${profile.Name} (AuthorApex)`);
        }

        // Check API enabled profiles
        if (profile.PermissionsApiEnabled) {
          apiEnabledProfiles.push(profile.Name);
        }
      }

      if (dangerousProfiles.length > 0) {
        this.addFinding({
          category: 'Profiles',
          severity: 'critical',
          title: 'Non-Admin Profiles with Dangerous Permissions',
          description:
            'Profiles other than System Administrator have dangerous permissions like ModifyAllData, ViewAllData, or AuthorApex.',
          affectedItems: dangerousProfiles,
          recommendation:
            'Review and remove these permissions from non-admin profiles. Use permission sets for specific elevated access needs.',
          reference: 'https://help.salesforce.com/s/articleView?id=sf.admin_profile.htm',
        });
      }

      if (apiEnabledProfiles.length > 5) {
        this.addFinding({
          category: 'Profiles',
          severity: 'medium',
          title: 'Many Profiles with API Access',
          description: `${apiEnabledProfiles.length} profiles have API access enabled. This increases the attack surface.`,
          affectedItems: apiEnabledProfiles,
          recommendation:
            'Review API access requirements and disable for profiles that do not need programmatic access.',
        });
      }

      this.log(`  ✓ Checked ${profiles.records.length} profiles`);
    } catch (error) {
      this.warn(`  ⚠ Could not audit profiles: ${(error as Error).message}`);
    }
  }

  private async auditPermissionSets(): Promise<void> {
    this.log('\n🔍 Auditing Permission Sets...');

    try {
      const permSets = await this.connection.query<PermissionSetInfo>(`
        SELECT Id, Name, Label, IsCustom, PermissionsModifyAllData, PermissionsViewAllData,
               PermissionsAuthorApex, PermissionsManageUsers, PermissionsApiEnabled
        FROM PermissionSet
        WHERE IsOwnedByProfile = false
      `);

      const dangerousPermSets: string[] = [];

      for (const ps of permSets.records) {
        if (ps.PermissionsModifyAllData) {
          dangerousPermSets.push(`${ps.Label} (ModifyAllData)`);
        }
        if (ps.PermissionsViewAllData) {
          dangerousPermSets.push(`${ps.Label} (ViewAllData)`);
        }
        if (ps.PermissionsAuthorApex) {
          dangerousPermSets.push(`${ps.Label} (AuthorApex)`);
        }
      }

      if (dangerousPermSets.length > 0) {
        this.addFinding({
          category: 'Permission Sets',
          severity: 'high',
          title: 'Permission Sets with Elevated Privileges',
          description:
            'Permission sets with dangerous system permissions can be assigned to any user, bypassing profile restrictions.',
          affectedItems: dangerousPermSets,
          recommendation:
            'Review permission set assignments and consider using permission set groups with muting to limit exposure.',
          reference: 'https://help.salesforce.com/s/articleView?id=sf.perm_sets_overview.htm',
        });
      }

      this.log(`  ✓ Checked ${permSets.records.length} permission sets`);
    } catch (error) {
      this.warn(`  ⚠ Could not audit permission sets: ${(error as Error).message}`);
    }
  }

  private async auditFieldLevelSecurity(): Promise<void> {
    this.log('\n🔍 Auditing Field-Level Security...');

    try {
      // Query custom fields that might contain sensitive data
      const fields = await this.connection.query<{
        Id: string;
        QualifiedApiName: string;
        EntityDefinition: { QualifiedApiName: string };
        Description: string;
      }>(`
        SELECT Id, QualifiedApiName, EntityDefinition.QualifiedApiName, Description
        FROM FieldDefinition
        WHERE EntityDefinition.IsCustomizable = true
        AND IsCompound = false
        LIMIT 2000
      `);

      const sensitiveFields: string[] = [];

      for (const field of fields.records) {
        const fieldName = field.QualifiedApiName.toLowerCase();
        const description = (field.Description || '').toLowerCase();

        for (const pattern of SENSITIVE_FIELD_PATTERNS) {
          if (pattern.test(fieldName) || pattern.test(description)) {
            sensitiveFields.push(
              `${field.EntityDefinition.QualifiedApiName}.${field.QualifiedApiName}`
            );
            break;
          }
        }
      }

      if (sensitiveFields.length > 0) {
        this.addFinding({
          category: 'Field-Level Security',
          severity: 'high',
          title: 'Potentially Sensitive Fields Detected',
          description:
            'Fields with names or descriptions suggesting sensitive data (SSN, credit card, passwords, etc.) were found. Verify field-level security is properly configured.',
          affectedItems: sensitiveFields,
          recommendation:
            'Review field-level security settings for these fields. Consider using Shield Platform Encryption for highly sensitive data.',
          reference: 'https://help.salesforce.com/s/articleView?id=sf.admin_fls.htm',
        });
      }

      this.log(`  ✓ Checked ${fields.records.length} fields`);
    } catch (error) {
      this.warn(`  ⚠ Could not audit field-level security: ${(error as Error).message}`);
    }
  }

  private async auditSharingRules(): Promise<void> {
    this.log('\n🔍 Auditing Sharing Settings...');

    try {
      // Query organization-wide defaults
      const owdSettings = await this.connection.query<{
        Id: string;
        DeveloperName: string;
        InternalSharingModel: string;
        ExternalSharingModel: string;
      }>(`
        SELECT Id, DeveloperName, InternalSharingModel, ExternalSharingModel
        FROM EntityDefinition
        WHERE IsCustomizable = true
        AND InternalSharingModel != null
        LIMIT 100
      `);

      const publicObjects: string[] = [];

      for (const obj of owdSettings.records) {
        if (
          obj.InternalSharingModel === 'ReadWrite' ||
          obj.InternalSharingModel === 'FullAccess'
        ) {
          publicObjects.push(`${obj.DeveloperName} (Internal: ${obj.InternalSharingModel})`);
        }
        if (
          obj.ExternalSharingModel === 'ReadWrite' ||
          obj.ExternalSharingModel === 'FullAccess'
        ) {
          publicObjects.push(`${obj.DeveloperName} (External: ${obj.ExternalSharingModel})`);
        }
      }

      if (publicObjects.length > 0) {
        this.addFinding({
          category: 'Sharing Rules',
          severity: 'medium',
          title: 'Objects with Public Read/Write Access',
          description:
            'Some objects have organization-wide defaults set to Public Read/Write, which may expose data unnecessarily.',
          affectedItems: publicObjects,
          recommendation:
            'Review if Public Read/Write is necessary. Consider using Private OWD with sharing rules for more granular control.',
          reference: 'https://help.salesforce.com/s/articleView?id=sf.security_sharing_owd.htm',
        });
      }

      this.log(`  ✓ Checked sharing settings for ${owdSettings.records.length} objects`);
    } catch (error) {
      this.warn(`  ⚠ Could not audit sharing settings: ${(error as Error).message}`);
    }
  }

  private async auditExternalOWD(): Promise<void> {
    this.log('\n🔍 Auditing External Organization-Wide Defaults...');

    try {
      // Query organization-wide defaults focusing on external sharing
      const owdSettings = await this.connection.query<{
        Id: string;
        SobjectType: string;
        InternalSharingModel: string;
        ExternalSharingModel: string;
      }>(`
        SELECT Id, SobjectType, InternalSharingModel, ExternalSharingModel
        FROM EntityDefinition
        WHERE IsCustomizable = true
        AND ExternalSharingModel != null
        LIMIT 200
      `);

      const externalReadWriteObjects: string[] = [];
      const externalReadObjects: string[] = [];
      const mismatchedObjects: string[] = [];

      for (const obj of owdSettings.records) {
        // Check for external Read/Write or FullAccess - most dangerous
        if (
          obj.ExternalSharingModel === 'ReadWrite' ||
          obj.ExternalSharingModel === 'FullAccess'
        ) {
          externalReadWriteObjects.push(
            `${obj.SobjectType} (External: ${obj.ExternalSharingModel})`
          );
        }
        // Check for external Read access
        else if (obj.ExternalSharingModel === 'Read') {
          externalReadObjects.push(`${obj.SobjectType} (External: Read)`);
        }

        // Check for mismatched internal vs external (external more permissive than internal)
        const sharingOrder = ['Private', 'Read', 'ReadWrite', 'FullAccess'];
        const internalIndex = sharingOrder.indexOf(obj.InternalSharingModel);
        const externalIndex = sharingOrder.indexOf(obj.ExternalSharingModel);
        
        if (externalIndex > internalIndex && externalIndex >= 0 && internalIndex >= 0) {
          mismatchedObjects.push(
            `${obj.SobjectType} (Internal: ${obj.InternalSharingModel}, External: ${obj.ExternalSharingModel})`
          );
        }
      }

      if (externalReadWriteObjects.length > 0) {
        this.addFinding({
          category: 'External OWD',
          severity: 'critical',
          title: 'Objects with External Read/Write Access',
          description:
            'Some objects have external organization-wide defaults set to Read/Write or FullAccess. This allows external users (portal users, community users) to read and modify all records of these objects.',
          affectedItems: externalReadWriteObjects,
          recommendation:
            'Set external OWD to Private and use sharing rules to grant access only to specific records. External users should have minimal access by default.',
          reference: 'https://help.salesforce.com/s/articleView?id=sf.security_sharing_owd_external.htm',
        });
      }

      if (externalReadObjects.length > 5) {
        this.addFinding({
          category: 'External OWD',
          severity: 'high',
          title: 'Many Objects with External Read Access',
          description:
            `${externalReadObjects.length} objects have external OWD set to Read. External users can view all records of these objects. Review if this level of access is necessary.`,
          affectedItems: externalReadObjects,
          recommendation:
            'Review each object and consider setting external OWD to Private with targeted sharing rules for specific record access.',
          reference: 'https://help.salesforce.com/s/articleView?id=sf.security_sharing_owd_external.htm',
        });
      }

      if (mismatchedObjects.length > 0) {
        this.addFinding({
          category: 'External OWD',
          severity: 'high',
          title: 'External OWD More Permissive Than Internal',
          description:
            'Some objects have external sharing settings that are more permissive than internal settings. This is unusual and may indicate a misconfiguration.',
          affectedItems: mismatchedObjects,
          recommendation:
            'Review these objects and ensure external access is not more permissive than internal access. External users should typically have equal or less access than internal users.',
        });
      }

      this.log(`  ✓ Checked external OWD for ${owdSettings.records.length} objects`);
    } catch (error) {
      this.warn(`  ⚠ Could not audit external OWD: ${(error as Error).message}`);
    }
  }

  private async auditGuestUserAccess(): Promise<void> {
    this.log('\n🔍 Auditing Guest User Access...');

    try {
      // Query guest user profiles
      const guestProfiles = await this.connection.query<{
        Id: string;
        Name: string;
        UserType: string;
        PermissionsModifyAllData: boolean;
        PermissionsViewAllData: boolean;
        PermissionsApiEnabled: boolean;
        PermissionsViewSetup: boolean;
        PermissionsManageUsers: boolean;
        PermissionsAuthorApex: boolean;
        PermissionsRunReports: boolean;
        PermissionsExportReport: boolean;
        PermissionsEditPublicDocuments: boolean;
        PermissionsEditPublicFilters: boolean;
        PermissionsEditPublicTemplates: boolean;
        PermissionsManagePublicDocuments: boolean;
        PermissionsManagePublicListViews: boolean;
        PermissionsManagePublicReports: boolean;
      }>(`
        SELECT Id, Name, UserType, 
               PermissionsModifyAllData, PermissionsViewAllData, PermissionsApiEnabled,
               PermissionsViewSetup, PermissionsManageUsers, PermissionsAuthorApex,
               PermissionsRunReports, PermissionsExportReport, PermissionsEditPublicDocuments,
               PermissionsEditPublicFilters, PermissionsEditPublicTemplates,
               PermissionsManagePublicDocuments, PermissionsManagePublicListViews,
               PermissionsManagePublicReports
        FROM Profile
        WHERE UserType IN ('Guest', 'CsnOnly', 'PowerCustomerSuccess', 'CustomerSuccess')
        OR Name LIKE '%Guest%'
        OR Name LIKE '%Site%'
      `);

      const dangerousGuestPermissions: string[] = [];
      const sensitiveGuestPermissions: string[] = [];
      const guestProfileNames: string[] = [];

      for (const profile of guestProfiles.records) {
        guestProfileNames.push(profile.Name);

        // Critical permissions that should NEVER be on guest profiles
        if (profile.PermissionsModifyAllData) {
          dangerousGuestPermissions.push(`${profile.Name}: ModifyAllData`);
        }
        if (profile.PermissionsViewAllData) {
          dangerousGuestPermissions.push(`${profile.Name}: ViewAllData`);
        }
        if (profile.PermissionsApiEnabled) {
          dangerousGuestPermissions.push(`${profile.Name}: API Enabled`);
        }
        if (profile.PermissionsViewSetup) {
          dangerousGuestPermissions.push(`${profile.Name}: View Setup`);
        }
        if (profile.PermissionsManageUsers) {
          dangerousGuestPermissions.push(`${profile.Name}: Manage Users`);
        }
        if (profile.PermissionsAuthorApex) {
          dangerousGuestPermissions.push(`${profile.Name}: Author Apex`);
        }

        // Sensitive permissions that should be reviewed
        if (profile.PermissionsRunReports) {
          sensitiveGuestPermissions.push(`${profile.Name}: Run Reports`);
        }
        if (profile.PermissionsExportReport) {
          sensitiveGuestPermissions.push(`${profile.Name}: Export Reports`);
        }
        if (profile.PermissionsEditPublicDocuments) {
          sensitiveGuestPermissions.push(`${profile.Name}: Edit Public Documents`);
        }
        if (profile.PermissionsManagePublicDocuments) {
          sensitiveGuestPermissions.push(`${profile.Name}: Manage Public Documents`);
        }
        if (profile.PermissionsManagePublicReports) {
          sensitiveGuestPermissions.push(`${profile.Name}: Manage Public Reports`);
        }
        if (profile.PermissionsManagePublicListViews) {
          sensitiveGuestPermissions.push(`${profile.Name}: Manage Public List Views`);
        }
      }

      // Query object permissions for guest profiles
      if (guestProfiles.records.length > 0) {
        const profileIds = guestProfiles.records.map((p) => `'${p.Id}'`).join(',');
        
        try {
          const objectPermissions = await this.connection.query<{
            Id: string;
            ParentId: string;
            SobjectType: string;
            PermissionsCreate: boolean;
            PermissionsRead: boolean;
            PermissionsEdit: boolean;
            PermissionsDelete: boolean;
            PermissionsViewAllRecords: boolean;
            PermissionsModifyAllRecords: boolean;
            Parent: { Name: string };
          }>(`
            SELECT Id, ParentId, SobjectType, 
                   PermissionsCreate, PermissionsRead, PermissionsEdit, PermissionsDelete,
                   PermissionsViewAllRecords, PermissionsModifyAllRecords,
                   Parent.Name
            FROM ObjectPermissions
            WHERE ParentId IN (${profileIds})
            AND (PermissionsCreate = true OR PermissionsEdit = true OR PermissionsDelete = true 
                 OR PermissionsViewAllRecords = true OR PermissionsModifyAllRecords = true)
          `);

          const guestObjectAccess: string[] = [];
          const guestModifyAccess: string[] = [];

          for (const perm of objectPermissions.records) {
            const profileName = perm.Parent?.Name || 'Unknown Profile';
            
            // ViewAll or ModifyAll on any object is dangerous for guest
            if (perm.PermissionsViewAllRecords) {
              guestModifyAccess.push(`${profileName}: ${perm.SobjectType} (View All Records)`);
            }
            if (perm.PermissionsModifyAllRecords) {
              guestModifyAccess.push(`${profileName}: ${perm.SobjectType} (Modify All Records)`);
            }
            
            // Create, Edit, Delete access should be reviewed
            const accessTypes: string[] = [];
            if (perm.PermissionsCreate) accessTypes.push('Create');
            if (perm.PermissionsEdit) accessTypes.push('Edit');
            if (perm.PermissionsDelete) accessTypes.push('Delete');
            
            if (accessTypes.length > 0) {
              guestObjectAccess.push(`${profileName}: ${perm.SobjectType} (${accessTypes.join(', ')})`);
            }
          }

          if (guestModifyAccess.length > 0) {
            this.addFinding({
              category: 'Guest User Access',
              severity: 'critical',
              title: 'Guest Profiles with View/Modify All Records',
              description:
                'Guest user profiles have View All Records or Modify All Records permissions on objects. This bypasses sharing rules and exposes all data to unauthenticated users.',
              affectedItems: guestModifyAccess,
              recommendation:
                'Remove View All Records and Modify All Records permissions from all guest profiles immediately. Guest users should only access records through sharing rules.',
              reference: 'https://help.salesforce.com/s/articleView?id=sf.networks_guest_user_sharing.htm',
            });
          }

          if (guestObjectAccess.length > 0) {
            this.addFinding({
              category: 'Guest User Access',
              severity: 'high',
              title: 'Guest Profiles with Create/Edit/Delete Access',
              description:
                'Guest user profiles have Create, Edit, or Delete permissions on objects. Review if this level of access is necessary for unauthenticated users.',
              affectedItems: guestObjectAccess,
              recommendation:
                'Review each object permission and remove Create, Edit, and Delete access unless absolutely required. Consider using authenticated community users instead.',
              reference: 'https://help.salesforce.com/s/articleView?id=sf.networks_guest_user_object_perms.htm',
            });
          }
        } catch (objPermError) {
          this.warn(`  ⚠ Could not query object permissions: ${(objPermError as Error).message}`);
        }
      }

      if (dangerousGuestPermissions.length > 0) {
        this.addFinding({
          category: 'Guest User Access',
          severity: 'critical',
          title: 'Guest Profiles with Dangerous System Permissions',
          description:
            'Guest user profiles have dangerous system permissions that should never be granted to unauthenticated users. This is a critical security vulnerability.',
          affectedItems: dangerousGuestPermissions,
          recommendation:
            'Immediately remove all dangerous permissions (ModifyAllData, ViewAllData, API Enabled, View Setup, Manage Users, Author Apex) from guest profiles.',
          reference: 'https://help.salesforce.com/s/articleView?id=sf.networks_guest_user_profile.htm',
        });
      }

      if (sensitiveGuestPermissions.length > 0) {
        this.addFinding({
          category: 'Guest User Access',
          severity: 'medium',
          title: 'Guest Profiles with Sensitive Permissions',
          description:
            'Guest user profiles have permissions that may expose sensitive data or functionality to unauthenticated users.',
          affectedItems: sensitiveGuestPermissions,
          recommendation:
            'Review these permissions and remove any that are not strictly necessary for guest user functionality.',
        });
      }

      this.log(`  ✓ Checked ${guestProfiles.records.length} guest/portal profiles`);
    } catch (error) {
      this.warn(`  ⚠ Could not audit guest user access: ${(error as Error).message}`);
    }
  }

  private async auditSessionSettings(): Promise<void> {
    this.log('\n🔍 Auditing Session Settings...');

    // Session settings require Setup API or metadata retrieval
    // For now, we'll add a general recommendation
    this.addFinding({
      category: 'Session Settings',
      severity: 'low',
      title: 'Session Settings Review Recommended',
      description:
        'Session settings should be reviewed manually to ensure proper timeout values, IP restrictions, and MFA requirements.',
      affectedItems: [
        'Session timeout duration',
        'Lock sessions to IP address',
        'Require MFA for all users',
        'Clickjack protection',
        'HTTPS requirement',
      ],
      recommendation:
        'Navigate to Setup > Session Settings and verify: Session timeout is 2 hours or less, Lock sessions to IP is enabled, MFA is required, Clickjack protection is enabled.',
      reference: 'https://help.salesforce.com/s/articleView?id=sf.admin_sessions.htm',
    });

    this.log('  ✓ Session settings audit recommendation added');
  }

  private async auditPasswordPolicies(): Promise<void> {
    this.log('\n🔍 Auditing Password Policies...');

    // Password policies require Setup API
    this.addFinding({
      category: 'Password Policies',
      severity: 'low',
      title: 'Password Policy Review Recommended',
      description:
        'Password policies should be reviewed to ensure they meet security requirements.',
      affectedItems: [
        'Minimum password length',
        'Password complexity requirements',
        'Password expiration',
        'Password history',
        'Lockout policy',
      ],
      recommendation:
        'Navigate to Setup > Password Policies and verify: Minimum 12 characters, Require mixed case + numbers + special characters, Expire passwords every 90 days, Remember last 12 passwords, Lock out after 5 failed attempts.',
      reference: 'https://help.salesforce.com/s/articleView?id=sf.admin_password.htm',
    });

    this.log('  ✓ Password policy audit recommendation added');
  }

  private async auditApexSecurity(sourcePath: string): Promise<void> {
    this.log('\n🔍 Auditing Apex Security...');

    if (!fs.existsSync(sourcePath)) {
      this.warn(`  ⚠ Source path not found: ${sourcePath}`);
      return;
    }

    const classesPath = path.join(sourcePath, 'classes');
    if (!fs.existsSync(classesPath)) {
      this.warn(`  ⚠ Classes directory not found: ${classesPath}`);
      return;
    }

    const classFiles = fs.readdirSync(classesPath).filter((f) => f.endsWith('.cls'));
    const withoutSharingClasses: string[] = [];
    const soqlInjectionRisks: string[] = [];
    const hardcodedCredentials: string[] = [];

    for (const file of classFiles) {
      const content = fs.readFileSync(path.join(classesPath, file), 'utf-8');
      const className = file.replace('.cls', '');

      // Check for without sharing
      if (/without\s+sharing/i.test(content)) {
        withoutSharingClasses.push(className);
      }

      // Check for potential SOQL injection
      if (/Database\.(query|getQueryLocator)\s*\([^)]*\+/i.test(content)) {
        soqlInjectionRisks.push(className);
      }
      if (/\[\s*SELECT[^]]*\+/i.test(content)) {
        soqlInjectionRisks.push(className);
      }

      // Check for hardcoded credentials patterns
      if (
        /password\s*=\s*['"][^'"]+['"]/i.test(content) ||
        /api[_-]?key\s*=\s*['"][^'"]+['"]/i.test(content) ||
        /secret\s*=\s*['"][^'"]+['"]/i.test(content)
      ) {
        hardcodedCredentials.push(className);
      }
    }

    if (withoutSharingClasses.length > 0) {
      this.addFinding({
        category: 'Apex Security',
        severity: 'high',
        title: 'Classes Using "without sharing"',
        description:
          'Classes declared with "without sharing" bypass record-level security. This should only be used when absolutely necessary.',
        affectedItems: [...new Set(withoutSharingClasses)],
        recommendation:
          'Review each class and change to "with sharing" unless there is a documented business requirement for bypassing security.',
        reference:
          'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_keywords_sharing.htm',
      });
    }

    if (soqlInjectionRisks.length > 0) {
      this.addFinding({
        category: 'Apex Security',
        severity: 'critical',
        title: 'Potential SOQL Injection Vulnerabilities',
        description:
          'Classes appear to use dynamic SOQL with string concatenation, which may be vulnerable to SOQL injection attacks.',
        affectedItems: [...new Set(soqlInjectionRisks)],
        recommendation:
          'Use bind variables instead of string concatenation in SOQL queries. Use String.escapeSingleQuotes() if dynamic queries are unavoidable.',
        reference:
          'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_dynamic_soql.htm',
      });
    }

    if (hardcodedCredentials.length > 0) {
      this.addFinding({
        category: 'Apex Security',
        severity: 'critical',
        title: 'Potential Hardcoded Credentials',
        description:
          'Classes appear to contain hardcoded passwords, API keys, or secrets. This is a serious security risk.',
        affectedItems: [...new Set(hardcodedCredentials)],
        recommendation:
          'Move credentials to Named Credentials, Custom Settings (protected), or Custom Metadata Types. Never hardcode sensitive values.',
        reference:
          'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_callouts_named_credentials.htm',
      });
    }

    this.log(`  ✓ Checked ${classFiles.length} Apex classes`);
  }

  private async auditRemoteSites(): Promise<void> {
    this.log('\n🔍 Auditing Remote Site Settings...');

    try {
      const remoteSites = await this.connection.query<RemoteSiteInfo>(`
        SELECT Id, SiteName, EndpointUrl, IsActive, DisableProtocolSecurity
        FROM RemoteProxy
        WHERE IsActive = true
      `);

      const insecureSites: string[] = [];
      const httpSites: string[] = [];

      for (const site of remoteSites.records) {
        if (site.DisableProtocolSecurity) {
          insecureSites.push(`${site.SiteName} (${site.EndpointUrl})`);
        }
        if (site.EndpointUrl.startsWith('http://')) {
          httpSites.push(`${site.SiteName} (${site.EndpointUrl})`);
        }
      }

      if (insecureSites.length > 0) {
        this.addFinding({
          category: 'Remote Sites',
          severity: 'high',
          title: 'Remote Sites with Disabled Protocol Security',
          description:
            'Some remote sites have protocol security disabled, which allows connections without certificate validation.',
          affectedItems: insecureSites,
          recommendation:
            'Enable protocol security for all remote sites unless there is a documented exception.',
        });
      }

      if (httpSites.length > 0) {
        this.addFinding({
          category: 'Remote Sites',
          severity: 'medium',
          title: 'Remote Sites Using HTTP (Not HTTPS)',
          description:
            'Some remote sites use unencrypted HTTP connections, which can expose data in transit.',
          affectedItems: httpSites,
          recommendation: 'Update remote sites to use HTTPS endpoints where possible.',
        });
      }

      this.log(`  ✓ Checked ${remoteSites.records.length} remote sites`);
    } catch (error) {
      this.warn(`  ⚠ Could not audit remote sites: ${(error as Error).message}`);
    }
  }

  private async auditConnectedApps(): Promise<void> {
    this.log('\n🔍 Auditing Connected Apps...');

    try {
      const connectedApps = await this.connection.query<ConnectedAppInfo>(`
        SELECT Id, Name, OptionsAllowAdminApprovedUsersOnly
        FROM ConnectedApplication
      `);

      const openApps: string[] = [];

      for (const app of connectedApps.records) {
        if (!app.OptionsAllowAdminApprovedUsersOnly) {
          openApps.push(app.Name);
        }
      }

      if (openApps.length > 0) {
        this.addFinding({
          category: 'Connected Apps',
          severity: 'medium',
          title: 'Connected Apps Allowing All Users',
          description:
            'Some connected apps are configured to allow all users rather than admin-approved users only.',
          affectedItems: openApps,
          recommendation:
            'Review connected app settings and enable "Admin approved users are pre-authorized" for sensitive integrations.',
          reference: 'https://help.salesforce.com/s/articleView?id=sf.connected_app_manage.htm',
        });
      }

      this.log(`  ✓ Checked ${connectedApps.records.length} connected apps`);
    } catch (error) {
      this.warn(`  ⚠ Could not audit connected apps: ${(error as Error).message}`);
    }
  }

  private addFinding(finding: Omit<SecurityFinding, 'id'>): void {
    // Generate a stable ID based on category and title
    // This ensures the same finding gets the same ID across regenerations
    const stableId = this.generateStableId(finding.category, finding.title);
    this.findings.push({
      id: stableId,
      ...finding,
    });
  }

  /**
   * Generate a stable, deterministic ID for a finding based on its category and title.
   * This ensures that the same finding will have the same ID across report regenerations,
   * allowing accepted findings to persist correctly.
   */
  private generateStableId(category: string, title: string): string {
    const input = `${category}:${title}`;
    // Simple hash function to create a short, stable identifier
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to positive hex string and take first 8 characters
    const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0').slice(0, 8);
    return `SEC-${hexHash}`;
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
    };
  }

  private generateReport(
    summary: AuditSummary,
    format: string,
    includeRecommendations: boolean
  ): string {
    if (format === 'json') {
      return JSON.stringify({ summary, findings: this.findings }, null, 2);
    } else if (format === 'html') {
      return this.generateHtmlReport(summary, includeRecommendations);
    } else {
      return this.generateMarkdownReport(summary, includeRecommendations);
    }
  }

  private generateHtmlReport(summary: AuditSummary, includeRecommendations: boolean): string {
    const template = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Audit Report</title>
    <style>
        :root {
            --critical-color: #dc3545;
            --high-color: #fd7e14;
            --medium-color: #ffc107;
            --low-color: #28a745;
            --accepted-color: #6c757d;
            --bg-color: #f8f9fa;
            --border-color: #dee2e6;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: var(--bg-color); padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; }
        .header h1 { font-size: 24px; margin-bottom: 10px; }
        .header-actions { margin-top: 15px; display: flex; gap: 10px; align-items: center; }
        .filter-controls { display: flex; gap: 10px; align-items: center; }
        .filter-controls label { display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 14px; }
        .filter-controls input[type="checkbox"] { cursor: pointer; }
        .summary-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 15px; padding: 20px; background: #f1f3f4; }
        .summary-card { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .summary-card .value { font-size: 36px; font-weight: bold; }
        .summary-card .label { color: #666; font-size: 12px; text-transform: uppercase; }
        .summary-card.critical .value { color: var(--critical-color); }
        .summary-card.high .value { color: var(--high-color); }
        .summary-card.medium .value { color: var(--medium-color); }
        .summary-card.low .value { color: var(--low-color); }
        .summary-card.accepted .value { color: var(--accepted-color); }
        .findings { padding: 20px; }
        .findings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .finding { border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 15px; overflow: hidden; transition: opacity 0.3s, transform 0.3s; }
        .finding.hidden { display: none; }
        .finding.accepted { opacity: 0.6; }
        .finding.accepted .finding-header { background: #f8f9fa; }
        .finding-header { padding: 15px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
        .finding-header:hover { background: #f8f9fa; }
        .finding.critical .finding-header { border-left: 4px solid var(--critical-color); }
        .finding.high .finding-header { border-left: 4px solid var(--high-color); }
        .finding.medium .finding-header { border-left: 4px solid var(--medium-color); }
        .finding.low .finding-header { border-left: 4px solid var(--low-color); }
        .finding.accepted .finding-header { border-left: 4px solid var(--accepted-color) !important; }
        .finding-title-section { flex: 1; }
        .finding-actions { display: flex; gap: 10px; align-items: center; }
        .severity-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .severity-badge.critical { background: var(--critical-color); color: white; }
        .severity-badge.high { background: var(--high-color); color: white; }
        .severity-badge.medium { background: var(--medium-color); color: #333; }
        .severity-badge.low { background: var(--low-color); color: white; }
        .accepted-badge { background: var(--accepted-color); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        .accept-btn { padding: 6px 16px; border-radius: 4px; border: none; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; }
        .accept-btn.accept { background: #e9ecef; color: #495057; }
        .accept-btn.accept:hover { background: #28a745; color: white; }
        .accept-btn.revoke { background: #ffc107; color: #333; }
        .accept-btn.revoke:hover { background: #e0a800; }
        .finding-body { padding: 15px; border-top: 1px solid var(--border-color); background: #fafafa; }
        .finding-body h4 { margin: 15px 0 10px; color: #555; }
        .finding-body ul { margin-left: 20px; }
        .finding-body li { margin: 5px 0; }
        .recommendation { background: #e7f3ff; border: 1px solid #b3d7ff; border-radius: 4px; padding: 10px; margin-top: 10px; }
        .acceptance-info { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 10px; margin-top: 10px; }
        .acceptance-info .accepted-by { font-weight: bold; }
        .acceptance-info .accepted-date { color: #666; font-size: 12px; }
        .acceptance-info .accepted-reason { margin-top: 5px; font-style: italic; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; background: #f8f9fa; }
        .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; justify-content: center; align-items: center; }
        .modal-overlay.active { display: flex; }
        .modal { background: white; border-radius: 8px; padding: 24px; max-width: 500px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .modal h3 { margin-bottom: 15px; }
        .modal label { display: block; margin-bottom: 5px; font-weight: 600; }
        .modal input, .modal textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 15px; font-family: inherit; }
        .modal textarea { min-height: 80px; resize: vertical; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .modal-actions button { padding: 10px 20px; border-radius: 4px; border: none; cursor: pointer; font-weight: 600; }
        .modal-actions .cancel-btn { background: #e9ecef; color: #495057; }
        .modal-actions .confirm-btn { background: #28a745; color: white; }
        .toast { position: fixed; bottom: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: 600; z-index: 1001; transform: translateY(100px); opacity: 0; transition: all 0.3s; }
        .toast.show { transform: translateY(0); opacity: 1; }
        .toast.success { background: #28a745; }
        .toast.error { background: #dc3545; }
        .toast.info { background: #17a2b8; }
        .export-btn { padding: 8px 16px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; }
        .export-btn:hover { background: #138496; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 Security Audit Report</h1>
            <div>Generated: {{auditDate}}</div>
            <div>Categories: {{categories}}</div>
            <div class="header-actions">
                <div class="filter-controls">
                    <label>
                        <input type="checkbox" id="hideAccepted" onchange="toggleAcceptedVisibility()">
                        Hide accepted findings
                    </label>
                    <label>
                        <input type="checkbox" id="showOnlyAccepted" onchange="toggleOnlyAcceptedVisibility()">
                        Show only accepted
                    </label>
                </div>
            </div>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <div class="value" id="totalCount">{{totalFindings}}</div>
                <div class="label">Total Findings</div>
            </div>
            <div class="summary-card critical">
                <div class="value" id="criticalCount">{{critical}}</div>
                <div class="label">Critical</div>
            </div>
            <div class="summary-card high">
                <div class="value" id="highCount">{{high}}</div>
                <div class="label">High</div>
            </div>
            <div class="summary-card medium">
                <div class="value" id="mediumCount">{{medium}}</div>
                <div class="label">Medium</div>
            </div>
            <div class="summary-card low">
                <div class="value" id="lowCount">{{low}}</div>
                <div class="label">Low</div>
            </div>
            <div class="summary-card accepted">
                <div class="value" id="acceptedCount">0</div>
                <div class="label">Accepted</div>
            </div>
        </div>

        <div class="findings">
            <div class="findings-header">
                <h2>Findings</h2>
            </div>
            {{#each findings}}
            <div class="finding {{severity}}" data-finding-id="{{id}}" data-severity="{{severity}}">
                <div class="finding-header" onclick="toggleFindingBody('{{id}}')">
                    <div class="finding-title-section">
                        <strong>{{id}}</strong> - {{title}}
                        <div style="color: #666; font-size: 14px;">{{category}}</div>
                    </div>
                    <div class="finding-actions">
                        <span class="accepted-badge" id="accepted-badge-{{id}}" style="display: none;">✓ ACCEPTED</span>
                        <span class="severity-badge {{severity}}">{{severity}}</span>
                        <button class="accept-btn accept" id="accept-btn-{{id}}" onclick="event.stopPropagation(); openAcceptModal('{{id}}', '{{title}}')">
                            Accept Risk
                        </button>
                        <button class="accept-btn revoke" id="revoke-btn-{{id}}" style="display: none;" onclick="event.stopPropagation(); revokeAcceptance('{{id}}')">
                            Revoke
                        </button>
                    </div>
                </div>
                <div class="finding-body" id="body-{{id}}" style="display: none;">
                    <p>{{description}}</p>
                    
                    <h4>Affected Items ({{affectedItems.length}})</h4>
                    <ul>
                        {{#each affectedItems}}
                        <li>{{this}}</li>
                        {{/each}}
                    </ul>

                    {{#if ../includeRecommendations}}
                    <div class="recommendation">
                        <strong>💡 Recommendation:</strong> {{recommendation}}
                    </div>
                    {{/if}}

                    {{#if reference}}
                    <div style="margin-top: 10px; font-size: 12px;">
                        <a href="{{reference}}" target="_blank">📚 Learn more</a>
                    </div>
                    {{/if}}

                    <div class="acceptance-info" id="acceptance-info-{{id}}" style="display: none;">
                        <strong>⚠️ Risk Accepted</strong>
                        <div class="accepted-by">By: <span id="accepted-by-{{id}}"></span></div>
                        <div class="accepted-date">Date: <span id="accepted-date-{{id}}"></span></div>
                        <div class="accepted-reason">Reason: <span id="accepted-reason-{{id}}"></span></div>
                    </div>
                </div>
            </div>
            {{/each}}

            {{#unless findings.length}}
            <div style="text-align: center; padding: 40px; color: #28a745;">
                <h3>✅ No security findings detected!</h3>
                <p>Your org passed all security checks in the selected categories.</p>
            </div>
            {{/unless}}
        </div>

        <div class="footer">
            Generated by DXB CLI - Security Audit Tool
        </div>
    </div>

    <!-- Accept Modal -->
    <div class="modal-overlay" id="acceptModal">
        <div class="modal">
            <h3>Accept Security Risk</h3>
            <p id="modalFindingTitle" style="margin-bottom: 15px; color: #666;"></p>
            <input type="hidden" id="modalFindingId">
            
            <label for="acceptedBy">Your Name / Team *</label>
            <input type="text" id="acceptedBy" placeholder="e.g., John Doe / Security Team" required>
            
            <label for="acceptReason">Reason for Acceptance *</label>
            <textarea id="acceptReason" placeholder="Explain why this risk is being accepted..."></textarea>
            
            <div class="modal-actions">
                <button class="cancel-btn" onclick="closeAcceptModal()">Cancel</button>
                <button class="confirm-btn" onclick="confirmAcceptance()">Accept Risk</button>
            </div>
        </div>
    </div>

    <!-- Toast Notification -->
    <div class="toast" id="toast"></div>

    <script>
        // Fixed JSON file name - always located in the same directory as this HTML file
        const JSON_FILE_NAME = 'security-audit-accepted.json';
        
        // Initialize accepted findings
        let acceptedFindings = {};
        let jsonFileHandle = null;
        
        // Load accepted findings on page load
        document.addEventListener('DOMContentLoaded', async function() {
            await loadAcceptedFindings();
            updateUI();
        });

        async function loadAcceptedFindings() {
            try {
                // Try to load from the JSON file in the same directory
                const response = await fetch(JSON_FILE_NAME);
                if (response.ok) {
                    const data = await response.json();
                    acceptedFindings = data.acceptedFindings || {};
                    console.log('Loaded accepted findings from JSON file:', Object.keys(acceptedFindings).length);
                } else {
                    console.log('No existing accepted findings file found, starting fresh');
                    acceptedFindings = {};
                }
            } catch (e) {
                console.log('Could not load JSON file (this is normal for first run):', e.message);
                // Fallback to localStorage
                try {
                    const stored = localStorage.getItem('security-audit-accepted');
                    if (stored) {
                        acceptedFindings = JSON.parse(stored);
                        console.log('Loaded from localStorage fallback');
                    }
                } catch (e2) {
                    acceptedFindings = {};
                }
            }
        }

        async function saveAcceptedFindings() {
            const exportData = {
                lastModified: new Date().toISOString(),
                acceptedFindings: acceptedFindings
            };
            
            // Always save to localStorage as backup
            try {
                localStorage.setItem('security-audit-accepted', JSON.stringify(acceptedFindings));
            } catch (e) {
                console.error('Error saving to localStorage:', e);
            }
            
            // Try to save to file using File System Access API
            try {
                if ('showSaveFilePicker' in window) {
                    // If we already have a file handle, use it
                    if (jsonFileHandle) {
                        await writeToFileHandle(jsonFileHandle, exportData);
                        showToast('Saved to ' + JSON_FILE_NAME, 'success');
                        return;
                    }
                    
                    // Otherwise, prompt user to save (first time only)
                    const options = {
                        suggestedName: JSON_FILE_NAME,
                        types: [{
                            description: 'JSON Files',
                            accept: { 'application/json': ['.json'] }
                        }]
                    };
                    
                    jsonFileHandle = await window.showSaveFilePicker(options);
                    await writeToFileHandle(jsonFileHandle, exportData);
                    showToast('Saved to file', 'success');
                } else {
                    // Fallback: Download the file
                    downloadJsonFile(exportData);
                }
            } catch (e) {
                if (e.name === 'AbortError') {
                    // User cancelled the save dialog
                    showToast('Save cancelled - data saved to browser storage', 'info');
                } else {
                    console.error('Error saving to file:', e);
                    showToast('Saved to browser storage (file save not available)', 'info');
                }
            }
        }

        async function writeToFileHandle(fileHandle, data) {
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
        }

        function downloadJsonFile(data) {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = JSON_FILE_NAME;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Downloaded ' + JSON_FILE_NAME + ' - please save it in the same folder as this HTML file', 'info');
        }

        function updateUI() {
            let acceptedCount = 0;
            
            document.querySelectorAll('.finding').forEach(finding => {
                const findingId = finding.dataset.findingId;
                const isAccepted = acceptedFindings[findingId] !== undefined;
                
                if (isAccepted) {
                    acceptedCount++;
                    finding.classList.add('accepted');
                    
                    // Update buttons
                    document.getElementById('accept-btn-' + findingId).style.display = 'none';
                    document.getElementById('revoke-btn-' + findingId).style.display = 'inline-block';
                    document.getElementById('accepted-badge-' + findingId).style.display = 'inline-block';
                    
                    // Update acceptance info
                    const info = acceptedFindings[findingId];
                    document.getElementById('acceptance-info-' + findingId).style.display = 'block';
                    document.getElementById('accepted-by-' + findingId).textContent = info.acceptedBy;
                    document.getElementById('accepted-date-' + findingId).textContent = new Date(info.acceptedDate).toLocaleString();
                    document.getElementById('accepted-reason-' + findingId).textContent = info.reason;
                } else {
                    finding.classList.remove('accepted');
                    
                    // Update buttons
                    document.getElementById('accept-btn-' + findingId).style.display = 'inline-block';
                    document.getElementById('revoke-btn-' + findingId).style.display = 'none';
                    document.getElementById('accepted-badge-' + findingId).style.display = 'none';
                    document.getElementById('acceptance-info-' + findingId).style.display = 'none';
                }
            });
            
            // Update accepted count in summary
            document.getElementById('acceptedCount').textContent = acceptedCount;
            
            // Apply visibility filters
            toggleAcceptedVisibility();
        }

        function toggleFindingBody(findingId) {
            const body = document.getElementById('body-' + findingId);
            body.style.display = body.style.display === 'none' ? 'block' : 'none';
        }

        function openAcceptModal(findingId, title) {
            document.getElementById('modalFindingId').value = findingId;
            document.getElementById('modalFindingTitle').textContent = findingId + ': ' + title;
            document.getElementById('acceptedBy').value = '';
            document.getElementById('acceptReason').value = '';
            document.getElementById('acceptModal').classList.add('active');
        }

        function closeAcceptModal() {
            document.getElementById('acceptModal').classList.remove('active');
        }

        async function confirmAcceptance() {
            const findingId = document.getElementById('modalFindingId').value;
            const acceptedBy = document.getElementById('acceptedBy').value.trim();
            const reason = document.getElementById('acceptReason').value.trim();
            
            if (!acceptedBy) {
                showToast('Please enter your name or team', 'error');
                return;
            }
            
            if (!reason) {
                showToast('Please provide a reason for acceptance', 'error');
                return;
            }
            
            acceptedFindings[findingId] = {
                acceptedBy: acceptedBy,
                acceptedDate: new Date().toISOString(),
                reason: reason
            };
            
            await saveAcceptedFindings();
            updateUI();
            closeAcceptModal();
        }

        async function revokeAcceptance(findingId) {
            if (confirm('Are you sure you want to revoke the acceptance for ' + findingId + '?')) {
                delete acceptedFindings[findingId];
                await saveAcceptedFindings();
                updateUI();
                showToast('Acceptance revoked for ' + findingId, 'info');
            }
        }

        function toggleAcceptedVisibility() {
            const hideAccepted = document.getElementById('hideAccepted').checked;
            const showOnlyAccepted = document.getElementById('showOnlyAccepted').checked;
            
            document.querySelectorAll('.finding').forEach(finding => {
                const isAccepted = finding.classList.contains('accepted');
                
                if (hideAccepted && isAccepted) {
                    finding.classList.add('hidden');
                } else if (showOnlyAccepted && !isAccepted) {
                    finding.classList.add('hidden');
                } else {
                    finding.classList.remove('hidden');
                }
            });
        }

        function toggleOnlyAcceptedVisibility() {
            // Uncheck the other checkbox to avoid conflicts
            if (document.getElementById('showOnlyAccepted').checked) {
                document.getElementById('hideAccepted').checked = false;
            }
            toggleAcceptedVisibility();
        }

        function showToast(message, type) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast ' + type + ' show';
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    </script>
</body>
</html>`;

    Handlebars.registerHelper('eq', (a, b) => a === b);

    const compiledTemplate = Handlebars.compile(template);
    return compiledTemplate({
      ...summary,
      categories: summary.categoriesAudited.join(', '),
      findings: this.findings,
      includeRecommendations,
    });
  }

  private generateMarkdownReport(summary: AuditSummary, includeRecommendations: boolean): string {
    let md = `# 🔒 Security Audit Report

**Generated:** ${summary.auditDate}  
**Categories Audited:** ${summary.categoriesAudited.join(', ')}

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | ${summary.critical} |
| 🟠 High | ${summary.high} |
| 🟡 Medium | ${summary.medium} |
| 🟢 Low | ${summary.low} |
| **Total** | **${summary.totalFindings}** |

---

## Findings

`;

    if (this.findings.length === 0) {
      md += `✅ **No security findings detected!** Your org passed all security checks in the selected categories.

`;
    } else {
      // Group findings by severity
      const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low'];
      const severityEmoji: Record<Severity, string> = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
      };

      for (const severity of severityOrder) {
        const severityFindings = this.findings.filter((f) => f.severity === severity);
        if (severityFindings.length === 0) continue;

        md += `### ${severityEmoji[severity]} ${severity.charAt(0).toUpperCase() + severity.slice(1)} Severity

`;

        for (const finding of severityFindings) {
          md += `#### ${finding.id}: ${finding.title}

**Category:** ${finding.category}

${finding.description}

**Affected Items (${finding.affectedItems.length}):**
`;
          for (const item of finding.affectedItems) {
            md += `- ${item}
`;
          }

          if (includeRecommendations) {
            md += `
> 💡 **Recommendation:** ${finding.recommendation}
`;
          }

          if (finding.reference) {
            md += `
📚 [Learn more](${finding.reference})
`;
          }

          md += `
---

`;
        }
      }
    }

    md += `
*Generated by DXB CLI - Security Audit Tool*
`;

    return md;
  }
}
