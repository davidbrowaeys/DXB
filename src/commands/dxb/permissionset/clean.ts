import { flags, SfdxCommand } from '@salesforce/command';

const path = require('path');
const fs = require('fs');
var xml2js = require('xml2js');
var js2xmlparser = require('js2xmlparser');

function clean(rootdir:string,profilename:string, extension:string){
    var profilepath = path.join(rootdir,`${profilename}.${extension}`);
    fs.readFile(profilepath, (err:any, data:any) => {
        var parser = new xml2js.Parser( {"explicitArray":false});
        parser.parseString(data,function (err:any, result:any) {
                // //profile
                // fs.writeFileSync(outprofilepath+'/'+profilename+'.json', JSON.stringify({
                //     "custom" : result.PermissionSet.custom,
                //     "userLicense" : result.PermissionSet.userLicense,
                //     "fileExtension" : extension
                // }, null, 2));
                // //classAccesses
                // if (!result){
                //     console.log(`Could not split ${profilename}`);
                //     return;
                // }
                // //applicationVisibilities
                // if (result.PermissionSet.applicationVisibilities){
                //     if (!fs.existsSync(outprofilepath+'/applicationVisibilities')) {
                //         fs.mkdirSync(outprofilepath+'/applicationVisibilities');
                //     }
                //     if (!Array.isArray(result.PermissionSet.applicationVisibilities)){
                //         result.PermissionSet.applicationVisibilities = [result.PermissionSet.applicationVisibilities];
                //     }
                //     result.PermissionSet.applicationVisibilities.forEach((elem:any) => {
                //         fs.writeFileSync(outprofilepath+'/applicationVisibilities/'+elem.application+'.json', JSON.stringify(elem, null, 2));
                //     });
                // }
                // //classAccesses
                // if (result.PermissionSet.classAccesses){
                //     if (!fs.existsSync(outprofilepath+'/classAccesses')) {
                //         fs.mkdirSync(outprofilepath+'/classAccesses');
                //     }
                //     if (!Array.isArray(result.PermissionSet.classAccesses)){
                //         result.PermissionSet.classAccesses = [result.PermissionSet.classAccesses];
                //     }
                //     result.PermissionSet.classAccesses.forEach((elem:any) =>{
                //         fs.writeFileSync(outprofilepath+'/classAccesses/'+elem.apexClass+'.json', JSON.stringify(elem, null, 2));
                //     });
                // }
                //objectPermissions
                if (result.PermissionSet.objectPermissions){
                    if(Array.isArray(result.PermissionSet.objectPermissions)){
                        result.PermissionSet.objectPermissions = result.PermissionSet.objectPermissions.filter((value:any, index:any, arr:any) =>{
                            return  value.allowCreate === 'true' || 
                                    value.allowDelete === 'true' || 
                                    value.allowEdit === 'true' || 
                                    value.allowRead === 'true' || 
                                    value.modifyAllRecords === 'true' || 
                                    value.viewAllRecords === 'true';
                        });
                    }else if (  result.PermissionSet.objectPermissions.allowCreate === 'false' && 
                                result.PermissionSet.objectPermissions.allowDelete === 'false' && 
                                result.PermissionSet.objectPermissions.allowEdit === 'false' && 
                                result.PermissionSet.objectPermissions.allowRead === 'false' && 
                                result.PermissionSet.objectPermissions.modifyAllRecords === 'false' && 
                                result.PermissionSet.fieldPermissions.viewAllRecords === 'false'){
                        delete result.PermissionSet.objectPermissions;
                    }
                        
                }
                //fieldPermissions
                if (result.PermissionSet.fieldPermissions){
                    if(Array.isArray(result.PermissionSet.fieldPermissions)){
                        result.PermissionSet.fieldPermissions = result.PermissionSet.fieldPermissions.filter((value:any, index:any, arr:any) =>{
                            return value.readable === 'true' || value.editable === 'true';
                        });
                    }else if (result.PermissionSet.fieldPermissions.readable === 'false' && result.PermissionSet.fieldPermissions.editable){
                        delete result.PermissionSet.fieldPermissions;
                    }
                }
                //classAccesses
                if (result.PermissionSet.classAccesses){
                    if(Array.isArray(result.PermissionSet.classAccesses)){
                        result.PermissionSet.classAccesses = result.PermissionSet.classAccesses.filter((value:any, index:any, arr:any) =>{
                            return value.enabled === 'true';
                        });
                    }else if (result.PermissionSet.classAccesses.enabled === 'false'){
                        delete result.PermissionSet.classAccesses;
                    }
                }
                //pageAccesses
                if (result.PermissionSet.pageAccesses){
                    if(Array.isArray(result.PermissionSet.pageAccesses)){
                        result.PermissionSet.pageAccesses = result.PermissionSet.pageAccesses.filter((value:any, index:any, arr:any) =>{
                            return value.enabled === 'true';
                        });
                    }else if (result.PermissionSet.pageAccesses.enabled === 'false'){
                        delete result.PermissionSet.pageAccesses;
                    }
                }
                //userPermissions
                if (result.PermissionSet.userPermissions){
                    if(Array.isArray(result.PermissionSet.userPermissions)){
                        result.PermissionSet.userPermissions = result.PermissionSet.userPermissions.filter((value:any, index:any, arr:any) =>{
                            return value.enabled === 'true';
                        });
                    }else if (result.PermissionSet.userPermissions.enabled === 'false'){
                        delete result.PermissionSet.userPermissions;
                    }
                }
                //recordTypeVisibilities
                if (result.PermissionSet.recordTypeVisibilities){
                    if(Array.isArray(result.PermissionSet.recordTypeVisibilities)){
                        result.PermissionSet.recordTypeVisibilities = [...result.PermissionSet.recordTypeVisibilities].filter((value:any, index:any, arr:any) =>{
                            return value.visible === 'true';
                        });
                    }else if (result.PermissionSet.recordTypeVisibilities.visible === 'false'){
                        delete result.PermissionSet.recordTypeVisibilities;
                    }
                }
                delete result.PermissionSet['$'];
                result.PermissionSet['@'] = { xmlns: 'http://soap.sforce.com/2006/04/metadata' };
                var xml = js2xmlparser.parse("PermissionSet", result.PermissionSet, { declaration: { encoding: 'UTF-8' }});
                fs.writeFileSync(profilepath, xml);
                console.log(`Permissionsets(s) cleaned: ${profilepath}`);
        });
    });
}

export default class PermSetClean extends SfdxCommand {

    public static description = 'This command remove fls and object where all access are set to false';
  
    public static examples = [
    `sfdx dxb:permissionset:clean -p Customer_Community_My_Application -r src/permissionsets`,
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        permissionsetname : flags.string({char:'p',description:'Permission set name to be converted'}),
        rootdir : flags.string({char:'r',description:'source path to permissionsets metadata directory, i.e.: src/permissionsets or force-app/main/default/permissionsets', default:'force-app/main/default/permissionsets'})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = true;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;
  
    public async run() {
        var profilename:string = this.flags.permissionsetname;
        var rootdir:string = this.flags.rootdir;
        if (profilename){
            try{
                if (fs.existsSync(path.join(rootdir,profilename+'.permissionset'))){
                    clean(rootdir, profilename,'permissionset');
                }    
            }catch(err){
                console.log(`Could not find ${profilename}.permissionset`);
            }
            try{
                if (fs.existsSync(path.join(rootdir,profilename+'.permissionset-meta.xml'))){
                    clean(rootdir, profilename,'permissionset-meta.xml');
                }
            }catch(err){
                console.log(`Could not find ${profilename}.permissionset-meta.xml`);
            }
        }else{
            fs.readdirSync(rootdir).forEach( (file:string) => {
                if (file.indexOf('.permissionset-meta.xml') >= 0 || file.indexOf('.permissionset') >= 0){
                    profilename = file.split('.')[0];
                    var extension:string = file.substring(file.indexOf('permissionset'));
                    try{
                        clean(rootdir, profilename, extension);
                    }catch(err){
                        console.log(`Could not split ${profilename}`);
                    }
                }
            });
        }
    }
}