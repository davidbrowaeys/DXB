import {
    flags,
    SfdxCommand
} from '@salesforce/command';
import * as path from 'path';
import * as fs from 'fs';
import * as xml2js from 'xml2js';
import * as js2xmlparser from 'js2xmlparser';

export default class PermSetClean extends SfdxCommand {

    public static description = 'This command remove fls and object where all access are set to "false"';

    public static examples = [
        `$  sfdx dxb:permissionset:clean -f force-app/main/default/permissionsets/Social_Customer_Service_Permission_Set.permissionset-meta.xml`
    ];

    public static args = [{
        name: 'file'
    }];

    protected static flagsConfig = {
        file: flags.string({
            char: 'f',
            description: 'File path pf permission set to clean'
        }),
        permissionsetname: flags.string({
            char: 'p',
            description: 'Permission set name to clean(deprecated)'
        }),
        rootdir: flags.string({
            char: 'r',
            description: 'source path to permissionsets metadata directory, i.e.: src/permissionsets or force-app/main/default/permissionsetsn(deprecated)',
            default: 'force-app/main/default/permissionsets'
        })
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;

    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = true;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;

    public async run() {
        const {permissionSetName, file, rootDir} = this.flags;

        if (permissionSetName) {
            this.cleanPermissionSet(rootDir, permissionSetName);
        } else if (file){
            this.clean(file);
        }else {
            this.cleanAllPermissionSets(rootDir);
        }
    }

    protected cleanPermissionSet(rootDir: string, permissionSetName: string) {
        const permissionSetPaths = this.getPermissionSetPaths(rootDir, permissionSetName);

        permissionSetPaths.forEach((filePath) => {
            if (fs.existsSync(filePath)) {
                const permissionSetPath = path.join(rootDir, `${permissionSetName}.${path.extname(filePath)}`);
                this.clean(permissionSetPath);
            } else {
                console.log(`Could not find ${filePath}`);
            }
        });
    }

    protected cleanAllPermissionSets(rootDir: string) {
        fs.readdirSync(rootDir).forEach((fileName) => {
            const fileExt = path.extname(fileName);
            if (fileExt === '.permissionset-meta.xml' || fileExt === '.permissionset') {
                const permissionSetName = fileName.split('.')[0];
                try {
                    const permissionSetPath = path.join(rootDir, `${permissionSetName}.${fileExt}`);
                    this.clean(permissionSetPath);
                } catch (err) {
                    console.log(`Could not clean up ${permissionSetName}: ${err}`);
                }
            }
        });
    }

    protected getPermissionSetPaths(rootDir: string, permissionSetName: string) {
        return [
            path.join(rootDir, `${permissionSetName}.permissionset`),
            path.join(rootDir, `${permissionSetName}.permissionset-meta.xml`)
        ];
    }

    protected async clean(permissionSetPath: string) {
        const data = await fs.promises.readFile(permissionSetPath, "utf8");

        const result = await xml2js.parseStringPromise(data, {
            explicitArray: false,
        });

        this.filterObjectPermissions(result);
        this.filterFieldPermissions(result);
        this.filterClassAccesses(result);
        this.filterPageAccesses(result);
        this.filterUserPermissions(result);
        this.filterRecordTypeVisibilities(result);

        delete result.PermissionSet["$"];
        result.PermissionSet["@"] = {
            xmlns: "http://soap.sforce.com/2006/04/metadata"
        };
        const xml = js2xmlparser.parse("PermissionSet", result.PermissionSet, {
            declaration: {
                encoding: "UTF-8"
            },
        });

        await fs.promises.writeFile(permissionSetPath, xml);
        console.log(`Permissionsets(s) cleaned: ${permissionSetPath}`);
    }

    private filterArrayByAttributeValue(arr: any[], attribute: string, value: string): any[] {
        return arr.filter((item) => item[attribute] === value);
    }

    private filterClassAccesses(result: any): void {
        const classAccesses = result.PermissionSet.classAccesses;

        if (!classAccesses) {
            return;
        }

        if (Array.isArray(classAccesses)) {
            result.PermissionSet.classAccesses = this.filterArrayByAttributeValue(
              classAccesses,
              "enabled",
              "true"
            );
            if (!result.PermissionSet.classAccesses.length) {
                delete result.PermissionSet.classAccesses;
            }
        } else if (result.PermissionSet.classAccesses.enabled === 'false') {
            delete result.PermissionSet.classAccesses;
        }
    }

    private filterPageAccesses(result: any): void {
        const pageAccesses = result.PermissionSet.pageAccesses;

        if (!pageAccesses) {
            return;
        }

        if (Array.isArray(pageAccesses)) {
            result.PermissionSet.pageAccesses = this.filterArrayByAttributeValue(
                pageAccesses,
                "enabled",
                "true"
            );
            if (!result.PermissionSet.pageAccesses.length) {
                delete result.PermissionSet.pageAccesses;
            }
        } else if (result.PermissionSet.pageAccesses.enabled === 'false') {
            delete result.PermissionSet.pageAccesses;
        }
    }


    private filterObjectPermissions(result: any): void {
        console.log(JSON.stringify(result.PermissionSet.objectPermissions));
        
        const objectPermissions = result.PermissionSet.objectPermissions;
        
        if (!result.PermissionSet.objectPermissions) {
            return;
        }
        if (Array.isArray(objectPermissions)) {
            result.PermissionSet.objectPermissions = this.filterArrayByAttributeValue(
                objectPermissions,
                "allowCreate",
                "true"
            ).concat(
                this.filterArrayByAttributeValue(objectPermissions, "allowDelete", "true"),
                this.filterArrayByAttributeValue(objectPermissions, "allowEdit", "true"),
                this.filterArrayByAttributeValue(objectPermissions, "allowRead", "true"),
                this.filterArrayByAttributeValue(objectPermissions, "modifyAllRecords", "true"),
                this.filterArrayByAttributeValue(objectPermissions, "viewAllRecords", "true")
            );
            if (!result.PermissionSet.objectPermissions.length) {
                delete result.PermissionSet.objectPermissions;
            }
        } else if (
            objectPermissions.allowCreate === "false" &&
            objectPermissions.allowDelete === "false" &&
            objectPermissions.allowEdit === "false" &&
            objectPermissions.allowRead === "false" &&
            objectPermissions.modifyAllRecords === "false" &&
            objectPermissions.viewAllRecords === "false"
          ) {
            delete result.PermissionSet.objectPermissions;
        }
    }

    private filterFieldPermissions(result: any): void {
        const fieldPermissions = result.PermissionSet.fieldPermissions;

        if (!fieldPermissions) {
            return;
        }

        if (Array.isArray(fieldPermissions)) {
            result.PermissionSet.fieldPermissions = this.filterArrayByAttributeValue(
                fieldPermissions,
                "readable",
                "true"
            ).concat(
                this.filterArrayByAttributeValue(fieldPermissions, "editable", "true")
            );

            if (!result.PermissionSet.fieldPermissions.length) {
                delete result.PermissionSet.fieldPermissions;
            }
        } else if (
            fieldPermissions.readable === "false" &&
            fieldPermissions.editable === "false"
        ) {
            delete result.PermissionSet.fieldPermissions;
        }
    }

    private filterRecordTypeVisibilities(result: any): void {
        const recordTypeVisibilities = result.PermissionSet.recordTypeVisibilities;

        if (!recordTypeVisibilities) {
            return;
        }

        if (Array.isArray(result.PermissionSet.recordTypeVisibilities)) {
            result.PermissionSet.recordTypeVisibilities = this.filterArrayByAttributeValue(
                recordTypeVisibilities,
                "visible",
                "true"
            );
            if (!result.PermissionSet.recordTypeVisibilities.length) {
                delete result.PermissionSet.recordTypeVisibilities;
            }
        } else if (recordTypeVisibilities.visible === 'false') {
            delete result.PermissionSet.recordTypeVisibilities;
        }
    }

    private filterUserPermissions(result: any): void {
        const userPermissions = result.PermissionSet.userPermissions;

        if (!userPermissions) {
            return;
        }

        if (Array.isArray(result.PermissionSet.userPermissions)) {
            result.PermissionSet.userPermissions = this.filterArrayByAttributeValue(
                userPermissions,
                "enabled",
                "true"
            );
            if (!result.PermissionSet.userPermissions.length) {
                delete result.PermissionSet.userPermissions;
            }
        } else if (result.PermissionSet.userPermissions.enabled === 'false') {
            delete result.PermissionSet.userPermissions;
        }
    }
}