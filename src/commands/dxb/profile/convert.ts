import { flags, SfdxCommand } from '@salesforce/command';
import * as path from 'path';
import * as fs from 'fs';
import { SfdxError } from '@salesforce/core';

var xml2js = require('xml2js');
var sourcepath;

function convertProfile(profilename) {
    var profilepath = path.join(sourcepath,profilename);
    var data = fs.readFileSync(`${profilepath}.profile-meta.xml`,{encoding: 'utf-8'}); 
    console.log('Read file');
    if (!fs.existsSync(profilepath)) {
        fs.mkdirSync(profilepath);
    }
    console.log('Created profile folder');
    console.log(`${profilepath}.profile-meta.xml`);
    var parser = new xml2js.Parser({ "explicitArray": false });
    if (!fs.existsSync(`${profilepath}.profile-meta.xml`)) {
        throw new SfdxError('Profile do not exist.');
    }
    parser.parseString(data, function (err, result) {
        if (err){
            console.log('Something went wrong converting this profile.');
            console.log(err);
        }else if (result){
            //profile
            fs.writeFileSync(profilepath + '/' + profilename + '.json', JSON.stringify({
                "custom": result.Profile.custom,
                "userLicense": result.Profile.userLicense,
                "loginHours": result.Profile.loginHours,
                "loginIpRanges": result.Profile.loginIpRanges,
                "userPermissions": result.Profile.userPermissions
            }, null, 2));
            
            if (!result) {
                console.log(`Could not split ${profilename}`);
                return;
            }
            //applicationVisibilities
            if (result.Profile.applicationVisibilities) {
                if (!fs.existsSync(profilepath + '/applicationVisibilities')) {
                    fs.mkdirSync(profilepath + '/applicationVisibilities');
                }
                if (!Array.isArray(result.Profile.applicationVisibilities)) {
                    result.Profile.applicationVisibilities = [result.Profile.applicationVisibilities];
                }
                result.Profile.applicationVisibilities.forEach(function (elem) {
                    fs.writeFileSync(profilepath + '/applicationVisibilities/' + elem.application + '.json', JSON.stringify(elem, null, 2));
                });
            }
            //classAccesses
            if (result.Profile.classAccesses) {
                if (!fs.existsSync(profilepath + '/classAccesses')) {
                    fs.mkdirSync(profilepath + '/classAccesses');
                }
                if (!Array.isArray(result.Profile.classAccesses)) {
                    result.Profile.classAccesses = [result.Profile.classAccesses];
                }
                result.Profile.classAccesses.forEach(function (elem) {
                    fs.writeFileSync(profilepath + '/classAccesses/' + elem.apexClass + '.json', JSON.stringify(elem, null, 2));
                });
            }
            //categoryGroupVisibilities
            if (result.Profile.categoryGroupVisibilities) {
                if (!fs.existsSync(profilepath + '/categoryGroupVisibilities')) {
                    fs.mkdirSync(profilepath + '/categoryGroupVisibilities');
                }
                if (!Array.isArray(result.Profile.categoryGroupVisibilities)) {
                    result.Profile.categoryGroupVisibilities = [result.Profile.categoryGroupVisibilities];
                }
                result.Profile.categoryGroupVisibilities.forEach(function (elem) {
                    fs.writeFileSync(profilepath + '/categoryGroupVisibilities/' + elem.dataCategoryGroup + '.json', JSON.stringify(elem, null, 2));
                });
            }
            //customMetadataTypeAccesses
            if (result.Profile.customMetadataTypeAccesses) {
                if (!fs.existsSync(profilepath + '/customMetadataTypeAccesses')) {
                    fs.mkdirSync(profilepath + '/customMetadataTypeAccesses');
                }
                if (!Array.isArray(result.Profile.customMetadataTypeAccesses)) {
                    result.Profile.customMetadataTypeAccesses = [result.Profile.customMetadataTypeAccesses];
                }
                result.Profile.customMetadataTypeAccesses.forEach(function (elem) {
                    fs.writeFileSync(profilepath + '/customMetadataTypeAccesses/' + elem.name + '.json', JSON.stringify(elem, null, 2));
                });
            }
            //objectPermissions
            if (result.Profile.objectPermissions) {
                if (!fs.existsSync(profilepath + '/objectPermissions')) {
                    fs.mkdirSync(profilepath + '/objectPermissions');
                }
                if (!Array.isArray(result.Profile.objectPermissions)) {
                    result.Profile.objectPermissions = [result.Profile.objectPermissions];
                }
                result.Profile.objectPermissions.forEach(function (elem) {
                    if (!fs.existsSync(profilepath + '/objectPermissions/' + elem.object)) {
                        fs.mkdirSync(profilepath + '/objectPermissions/' + elem.object);
                    }
                    fs.writeFileSync(profilepath + '/objectPermissions/' + elem.object + '/' + elem.object + '.json', JSON.stringify(elem, null, 2));
                });
            }
            //fieldPermissions
            if (result.Profile.fieldPermissions) {
                if (!fs.existsSync(profilepath + '/objectPermissions')) {
                    fs.mkdirSync(profilepath + '/objectPermissions');
                }
                if (!Array.isArray(result.Profile.fieldPermissions)) {
                    result.Profile.fieldPermissions = [result.Profile.fieldPermissions];
                }
                result.Profile.fieldPermissions.forEach(function (elem) {
                    var objectName = elem.field.split('.')[0];
                    if (!fs.existsSync(profilepath + '/objectPermissions/' + objectName)) {
                        fs.mkdirSync(profilepath + '/objectPermissions/' + objectName);
                    }
                    if (!fs.existsSync(profilepath + '/objectPermissions/' + objectName + '/fieldPermissions')) {
                        fs.mkdirSync(profilepath + '/objectPermissions/' + objectName + '/fieldPermissions');
                    }
                    fs.writeFileSync(profilepath + '/objectPermissions/' + objectName + '/fieldPermissions/' + elem.field + '.json', JSON.stringify(elem, null, 2));
                });
            }
            //recordTypeVisibilities
            if (result.Profile.recordTypeVisibilities) {
                if (!fs.existsSync(profilepath + '/objectPermissions')) {
                    fs.mkdirSync(profilepath + '/objectPermissions');
                }
                if (!Array.isArray(result.Profile.recordTypeVisibilities)) {
                    result.Profile.recordTypeVisibilities = [result.Profile.recordTypeVisibilities];
                }
                result.Profile.recordTypeVisibilities.forEach(function (elem) {
                    var objectName = elem.recordType.split('.')[0];
                    if (!fs.existsSync(profilepath + '/objectPermissions/' + objectName)) {
                        fs.mkdirSync(profilepath + '/objectPermissions/' + objectName);
                    }
                    if (!fs.existsSync(profilepath + '/objectPermissions/' + objectName + '/recordTypeVisibilities')) {
                        fs.mkdirSync(profilepath + '/objectPermissions/' + objectName + '/recordTypeVisibilities');
                    }
                    fs.writeFileSync(profilepath + '/objectPermissions/' + objectName + '/recordTypeVisibilities/' + elem.recordType + '.json', JSON.stringify(elem, null, 2));
                });
            }
            //customPermissions
            if (result.Profile.customPermissions) {
                if (!fs.existsSync(profilepath + '/customPermissions')) {
                    fs.mkdirSync(profilepath + '/customPermissions');
                }
                if (!Array.isArray(result.Profile.customPermissions)) {
                    result.Profile.customPermissions = [result.Profile.customPermissions];
                }
                result.Profile.customPermissions.forEach(function (elem) {
                    fs.writeFileSync(profilepath + '/customPermissions/' + elem.name + '.json', JSON.stringify(elem, null, 2));
                });
            }
            //customSettingAccesses
            if (result.Profile.customSettingAccesses) {
                if (!fs.existsSync(profilepath + '/customSettingAccesses')) {
                    fs.mkdirSync(profilepath + '/customSettingAccesses');
                }
                if (!Array.isArray(result.Profile.customSettingAccesses)) {
                    result.Profile.customSettingAccesses = [result.Profile.customSettingAccesses];
                }
                result.Profile.customSettingAccesses.forEach(function (elem) {
                    fs.writeFileSync(profilepath + '/customSettingAccesses/' + elem.name + '.json', JSON.stringify(elem, null, 2));
                });
            }
            //externalDataSourceAccesses
            if (result.Profile.externalDataSourceAccesses) {
                if (!fs.existsSync(profilepath + '/externalDataSourceAccesses')) {
                    fs.mkdirSync(profilepath + '/externalDataSourceAccesses');
                }
                if (!Array.isArray(result.Profile.externalDataSourceAccesses)) {
                    result.Profile.externalDataSourceAccesses = [result.Profile.externalDataSourceAccesses];
                }
                result.Profile.externalDataSourceAccesses.forEach(function (elem) {
                    fs.writeFileSync(profilepath + '/externalDataSourceAccesses/' + elem.externalDataSource + '.json', JSON.stringify(elem, null, 2));
                });
            }
            //flowAccesses
            if (result.Profile.flowAccesses) {
                if (!fs.existsSync(profilepath + '/flowAccesses')) {
                    fs.mkdirSync(profilepath + '/flowAccesses');
                }
                if (!Array.isArray(result.Profile.flowAccesses)) {
                    result.Profile.flowAccesses = [result.Profile.flowAccesses];
                }
                result.Profile.flowAccesses.forEach(function (elem) {
                    fs.writeFileSync(profilepath + '/flowAccesses/' + elem.flowName + '.json', JSON.stringify(elem, null, 2));
                });
            }
            //pageAccesses
            if (result.Profile.pageAccesses) {
                if (!fs.existsSync(profilepath + '/pageAccesses')) {
                    fs.mkdirSync(profilepath + '/pageAccesses');
                }
                if (!Array.isArray(result.Profile.pageAccesses)) {
                    result.Profile.pageAccesses = [result.Profile.pageAccesses];
                }
                result.Profile.pageAccesses.forEach(function (elem) {
                    fs.writeFileSync(profilepath + '/pageAccesses/' + elem.apexPage + '.json', JSON.stringify(elem, null, 2));
                });
            }
            //tabVisibilities
            if (result.Profile.tabVisibilities) {
                if (!fs.existsSync(profilepath + '/tabVisibilities')) {
                    fs.mkdirSync(profilepath + '/tabVisibilities');
                }
                if (!Array.isArray(result.Profile.tabVisibilities)) {
                    result.Profile.tabVisibilities = [result.Profile.tabVisibilities];
                }
                result.Profile.tabVisibilities.forEach(function (elem) {
                    fs.writeFileSync(profilepath + '/tabVisibilities/' + elem.tab + '.json', JSON.stringify(elem, null, 2));
                });
            }
            //layoutAssignments
            if (result.Profile.layoutAssignments) {
                if (!fs.existsSync(profilepath + '/layoutAssignments')) {
                    fs.mkdirSync(profilepath + '/layoutAssignments');
                }
                if (!Array.isArray(result.Profile.layoutAssignments)) {
                    result.Profile.layoutAssignments = [result.Profile.layoutAssignments];
                }
                result.Profile.layoutAssignments.forEach(function (elem) {
                    var key = elem.recordType || elem.layout;
                    fs.writeFileSync(profilepath + '/layoutAssignments/' + key + '.json', JSON.stringify(elem, null, 2));
                });
            }
            //userPermissions
            // if (result.Profile.userPermissions){
            //     if (!fs.existsSync(profilepath+'/userPermissions')) {
            //         fs.mkdirSync(profilepath+'/userPermissions');
            //     }
            //     if (!Array.isArray(result.Profile.userPermissions)){
            //         result.Profile.userPermissions = [result.Profile.userPermissions];
            //     }
            //     result.Profile.userPermissions.forEach(function(elem){
            //         fs.writeFileSync(profilepath+'/userPermissions/'+elem.name+'.json', JSON.stringify(elem, null, 2));
            //     });
            // }
            console.log('Converted:',profilename);
        }
    });
}

export default class PofileConvert extends SfdxCommand {

    public static description = 'Convert profile xml into small chunks of json files';

    public static examples = [
        `$ sfdx dxb:profile:convert`,
        `$ sfdx dxb:profile:convert -p Admin -r src/profiles`
    ];

    public static args = [{ name: 'file' }];

    protected static flagsConfig = {
        profilename: flags.string({ char: 'p', description: 'Profile name to be converted' }),
        sourcepath: flags.string({ char: 'r', description: 'Path to profile files', default: 'force-app/main/default/profiles' })
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = false;

    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;

    public async run() {
        var profilename = this.flags.profilename;
        sourcepath = this.flags.sourcepath;
        if (profilename) {
            try {
                convertProfile(profilename);
            } catch (err) {
                console.log(`Could not convert ${profilename}`);
            }
        } else {
            fs.readdirSync(sourcepath).forEach(file => {
                if (file.indexOf('profile-meta.xml') >= 0) {
                    profilename = file.split('.')[0];
                    try {
                        convertProfile(profilename);
                    } catch (err) {
                        console.log(`Could not split ${profilename}`);
                    }
                }
            });
        }
    }
}