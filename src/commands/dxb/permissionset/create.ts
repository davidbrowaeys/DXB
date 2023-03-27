import {
    flags,
    SfdxCommand
} from '@salesforce/command';
import * as fs from 'fs';
import * as xml2js from 'xml2js';
import * as js2xmlparser from 'js2xmlparser';

export default class PermissionSetCreate extends SfdxCommand {

    public static description = 'This command create a permission set from a profile without layotu and category group visiblity"';

    public static examples = [
        `$  sfdx dxb:permissionset:create -p force-app/main/default/profile/Admin.profile-meta.xml -n AdminPermissionSet`
    ];

    public static args = [{
        name: 'file'
    }];

    protected static flagsConfig = {
        profile: flags.string({
            char: 'p',
            description: 'File path pf profile to create the permission set from',
            required:true
        }),
        permissionsetname: flags.string({
            char: 'n',
            description: 'Name of the permision set to create',
            required:true
        }),
        outputdir: flags.string({
            char: 'o',
            description: 'Output path of the permision set to create',
            default: 'force-app/main/default/permissionsets'
        }),
        hasactivationrequired: flags.boolean({
            char: 'a',
            description: 'Indicates whether the permission set requires an associated active session (true) or not (false). The default value is false. This field is available in API version 53.0 and later.',
            default: false
        }),
        license: flags.string({
            char: 'l',
            description: 'License name of thep permision set to create',
            default: 'Salesforce'
        }),
        description: flags.string({
            char: 'd',
            description: 'Description of the permission set to create',
        })
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;

    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = true;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;

    public async run() {
        const {profile, permissionsetname, outputdir,hasactivationrequired, license, description} = this.flags;
        try{
            const permissionSetPath = `${outputdir}/${permissionsetname}.permissionset-meta.xml`;
            const data = await fs.promises.readFile(profile, "utf8");
            const profileName = profile.split('/');
            const result = (await xml2js.parseStringPromise(data, {
                explicitArray: false,
            }))?.Profile;
            let permissionSet:any = {
                label: permissionsetname,
                hasActivationRequired:hasactivationrequired,
                description: `Permission Set created from ${profileName[profileName.length - 1]}`
            };
            if (license) permissionSet.license = license;
            if (description) permissionSet.description = description;
            if (result.applicationVisibilities) permissionSet.applicationVisibilities = result.applicationVisibilities;
            if (result.classAccesses) permissionSet.classAccesses = result.classAccesses;
            if (result.customMetadataTypeAccesses) permissionSet.customMetadataTypeAccesses = result.customMetadataTypeAccesses;
            if (result.customPermissions) permissionSet.customPermissions = result.customPermissions;
            if (result.customSettingAccesses) permissionSet.customSettingAccesses = result.customSettingAccesses;
            if (result.externalDataSourceAccesses) permissionSet.externalDataSourceAccesses = result.externalDataSourceAccesses;
            if (result.flowAccesses) permissionSet.flowAccesses = result.flowAccesses;
            if (result.objectPermissions) permissionSet.objectPermissions = result.objectPermissions;
            if (result.fieldPermissions) permissionSet.fieldPermissions = result.fieldPermissions;
            if (result.recordTypeVisibilities) permissionSet.recordTypeVisibilities = result.recordTypeVisibilities;
            if (result.pageAccesses) permissionSet.pageAccesses = result.pageAccesses;
            if (result.tabVisibilities) permissionSet.tabVisibilities = result.tabVisibilities;
            if (result.userPermissions) permissionSet.userPermissions = result.userPermissions;

            const xml = js2xmlparser.parse("PermissionSet", permissionSet, {
                declaration: {
                    encoding: "UTF-8"
                },
            });

            await fs.promises.writeFile(permissionSetPath, xml);
            console.log(`Permissionsets(s) created: ${permissionSetPath}`);
        }catch(err){
            console.error(err);
        }
    }
}