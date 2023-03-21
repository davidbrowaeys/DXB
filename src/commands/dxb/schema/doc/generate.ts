import { SfdxCommand } from '@salesforce/command';
import { Connection, SfdxError } from '@salesforce/core';
import * as fs from 'fs';
import * as pdf from 'pdf-creator-node';

const STDOBJECTS = "'Account','Contact','AccountContactRelation','Opportunity','Asset','Event','Task'";
const STDQUERY = "SELECT Id, DurableId, LastModifiedDate, LastModifiedById, QualifiedApiName, NamespacePrefix, DeveloperName, MasterLabel, Label, PluralLabel, DefaultCompactLayoutId, IsCustomizable, IsApexTriggerable, IsWorkflowEnabled, IsProcessEnabled, IsCompactLayoutable, DeploymentStatus, KeyPrefix, IsCustomSetting, IsDeprecatedAndHidden, IsReplicateable, IsRetrieveable, IsSearchLayoutable, IsSearchable, IsTriggerable, IsIdEnabled, IsEverCreatable, IsEverUpdatable, IsEverDeletable, IsFeedEnabled, IsQueryable, IsMruEnabled, DetailUrl, EditUrl, NewUrl, EditDefinitionUrl, HelpSettingPageName, HelpSettingPageUrl, RunningUserEntityAccessId, PublisherId, IsLayoutable, RecordTypesSupported, InternalSharingModel, ExternalSharingModel, HasSubtypes, IsSubtype, IsAutoActivityCaptureEnabled, IsInterface, ImplementsInterfaces, ImplementedBy, ExtendsInterfaces, ExtendedBy, DefaultImplementation FROM EntityDefinition WHERE QualifiedApiName IN ("+STDOBJECTS+") ORDER BY NamespacePrefix, QualifiedApiName LIMIT 2000";
const CUSTOMQUERY = "SELECT Id, DurableId, LastModifiedDate, LastModifiedById, QualifiedApiName, NamespacePrefix, DeveloperName, MasterLabel, Label, PluralLabel, DefaultCompactLayoutId, IsCustomizable, IsApexTriggerable, IsWorkflowEnabled, IsProcessEnabled, IsCompactLayoutable, DeploymentStatus, KeyPrefix, IsCustomSetting, IsDeprecatedAndHidden, IsReplicateable, IsRetrieveable, IsSearchLayoutable, IsSearchable, IsTriggerable, IsIdEnabled, IsEverCreatable, IsEverUpdatable, IsEverDeletable, IsFeedEnabled, IsQueryable, IsMruEnabled, DetailUrl, EditUrl, NewUrl, EditDefinitionUrl, HelpSettingPageName, HelpSettingPageUrl, RunningUserEntityAccessId, PublisherId, IsLayoutable, RecordTypesSupported, InternalSharingModel, ExternalSharingModel, HasSubtypes, IsSubtype, IsAutoActivityCaptureEnabled, IsInterface, ImplementsInterfaces, ImplementedBy, ExtendsInterfaces, ExtendedBy, DefaultImplementation FROM EntityDefinition WHERE DeploymentStatus != null AND IsCustomizable = TRUE ORDER BY NamespacePrefix, QualifiedApiName LIMIT 2000";
const FIELDQUERY = "SELECT Id, DurableId, QualifiedApiName, EntityDefinitionId, NamespacePrefix, DeveloperName, MasterLabel, Label, Length, DataType, ServiceDataTypeId, ValueTypeId, ExtraTypeInfo, IsCalculated, IsHighScaleNumber, IsHtmlFormatted, IsNameField, IsNillable, IsWorkflowFilterable, IsCompactLayoutable, Precision, Scale, IsFieldHistoryTracked, IsIndexed, IsApiFilterable, IsApiSortable, IsListFilterable, IsListSortable, IsApiGroupable, IsListVisible, ControllingFieldDefinitionId, LastModifiedDate, LastModifiedById, PublisherId, RunningUserFieldAccessId, RelationshipName, ReferenceTo, ReferenceTargetField, IsCompound, IsSearchPrefilterable, IsPolymorphicForeignKey, IsAiPredictionField, BusinessOwnerId, BusinessStatus, SecurityClassification, ComplianceGroup, Description FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = '{{object_name}}' ORDER BY NamespacePrefix, QualifiedApiName";

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
        let std_objects = await this.query(STDQUERY);
        await this.getFieldDefinitionForSObject(std_objects);
        let cust_objects = await this.query(CUSTOMQUERY);
        await this.getFieldDefinitionForSObject(cust_objects);
        const documentMeta:any = JSON.parse(fs.readFileSync("/Users/dbrowaeys/workspace/DXB/src/lib/documentinfo.json", "utf8"));
        const html = fs.readFileSync("/Users/dbrowaeys/workspace/DXB/src/lib/schema-template.html", "utf8");
        const css = fs.readFileSync("/Users/dbrowaeys/workspace/DXB/src/lib/bootstrap.min.css", "utf8");
        const document = {
            html: html,
            data: {
                std_objects,
                cust_objects,
                document: documentMeta.documentInfo,
                style: "<style>"+css+"</style>"
            },
            path: "./sample_pdfoutput.pdf",
            type: "",
          };
        const pdfResult = await pdf.create(document, documentMeta.pdfOption);
        console.log(pdfResult);
    }

    private async getFieldDefinitionForSObject(sobjects: any[]): Promise<any[]> {
        return Promise.all(sobjects.map(async (o) => {
            o.fields = await this.query(FIELDQUERY.split('{{object_name}}').join(o.QualifiedApiName));
            return o;
        })).catch((error) => {
            console.log(error);
            throw new SfdxError(error);
        });
    }

    private async query(soql:string){
        return (await this.connection.query(soql)).records; 
    }
}