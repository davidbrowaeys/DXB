import { SfdxCommand } from '@salesforce/command';
import { Connection } from '@salesforce/core';
import * as fs from 'fs';
import * as pdf from 'pdf-creator-node';

const STDOBJECTS = "'Account','Contact','AccountContactRelation','Opportunity','Asset','Event','Task'";
const STDQUERY = "SELECT Id, DurableId, LastModifiedDate, LastModifiedById, QualifiedApiName, NamespacePrefix, DeveloperName, MasterLabel, Label, PluralLabel, DefaultCompactLayoutId, IsCustomizable, IsApexTriggerable, IsWorkflowEnabled, IsProcessEnabled, IsCompactLayoutable, DeploymentStatus, KeyPrefix, IsCustomSetting, IsDeprecatedAndHidden, IsReplicateable, IsRetrieveable, IsSearchLayoutable, IsSearchable, IsTriggerable, IsIdEnabled, IsEverCreatable, IsEverUpdatable, IsEverDeletable, IsFeedEnabled, IsQueryable, IsMruEnabled, DetailUrl, EditUrl, NewUrl, EditDefinitionUrl, HelpSettingPageName, HelpSettingPageUrl, RunningUserEntityAccessId, PublisherId, IsLayoutable, RecordTypesSupported, InternalSharingModel, ExternalSharingModel, HasSubtypes, IsSubtype, IsAutoActivityCaptureEnabled, IsInterface, ImplementsInterfaces, ImplementedBy, ExtendsInterfaces, ExtendedBy, DefaultImplementation FROM EntityDefinition WHERE QualifiedApiName IN ("+STDOBJECTS+") ORDER BY NamespacePrefix, QualifiedApiName LIMIT 2000";
const CUSTOMQUERY = "SELECT Id, DurableId, LastModifiedDate, LastModifiedById, QualifiedApiName, NamespacePrefix, DeveloperName, MasterLabel, Label, PluralLabel, DefaultCompactLayoutId, IsCustomizable, IsApexTriggerable, IsWorkflowEnabled, IsProcessEnabled, IsCompactLayoutable, DeploymentStatus, KeyPrefix, IsCustomSetting, IsDeprecatedAndHidden, IsReplicateable, IsRetrieveable, IsSearchLayoutable, IsSearchable, IsTriggerable, IsIdEnabled, IsEverCreatable, IsEverUpdatable, IsEverDeletable, IsFeedEnabled, IsQueryable, IsMruEnabled, DetailUrl, EditUrl, NewUrl, EditDefinitionUrl, HelpSettingPageName, HelpSettingPageUrl, RunningUserEntityAccessId, PublisherId, IsLayoutable, RecordTypesSupported, InternalSharingModel, ExternalSharingModel, HasSubtypes, IsSubtype, IsAutoActivityCaptureEnabled, IsInterface, ImplementsInterfaces, ImplementedBy, ExtendsInterfaces, ExtendedBy, DefaultImplementation FROM EntityDefinition WHERE DeploymentStatus != null AND IsCustomizable = TRUE ORDER BY NamespacePrefix, QualifiedApiName LIMIT 2000";

const PDFOPTION = {
    format: "A3",
    orientation: "portrait",
    border: "10mm",
    header: {
        height: "45mm",
        contents: '<div style="text-align: center;">Author: David Browaeys</div>'
    },
    footer: {
        height: "28mm",
        contents: {
            first: 'Cover page',
            2: 'Second page', // Any page number is working. 1-based index
            default: '<span style="color: #444;">{{page}}</span>/<span>{{pages}}</span>', // fallback value
            last: 'Last Page'
        }
    }
};

export default class SchemaDocGen extends SfdxCommand {

    public static description = '';

    public static examples = [
    ];

    public static args = [{ name: 'file' }];

    protected static flagsConfig = {};
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;

    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;

    protected connection:Connection;

    public async run() {
        this.connection = this.org.getConnection();
        const std_objects = await this.query(STDQUERY);
        const cust_objects = await this.query(CUSTOMQUERY);
        const html = fs.readFileSync("/Users/dbrowaeys/workspace/DXB/src/lib/schema-template.html", "utf8");
        const document = {
            html: html,
            data: {
                std_objects,
                cust_objects
            },
            path: "./sample_pdfoutput.pdf",
            type: "",
          };
        const pdfResult = await pdf.create(document, PDFOPTION);
        console.log(pdfResult);
    }

    private async query(soql:string){
        return (await this.connection.query(soql)).records; 
    }
}