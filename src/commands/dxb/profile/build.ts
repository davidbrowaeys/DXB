import { flags, SfdxCommand } from '@salesforce/command';
import * as path from 'path';
import * as fs from 'fs';
var js2xmlparser = require('js2xmlparser');
var sourcepath;

function buildProfile(profilename){
    console.log(profilename);
    var profilepath = path.join(sourcepath,profilename);
    //profile
    var profilesetting = JSON.parse(fs.readFileSync(profilepath+'/'+profilename+'.json').toString());

    var profile:any = {
        '@': { xmlns: 'http://soap.sforce.com/2006/04/metadata' }
    };
    if (profilesetting.custom){
        profile["custom"] = profilesetting.custom;
    }
    if (profilesetting.userLicense){
        profile["userLicense"] = profilesetting.userLicense;
    }
    if (profilesetting.loginHours){
        profile["loginHours"] = profilesetting.loginHours;
    }
    if (profilesetting.loginIpRanges){
        profile["loginIpRanges"] = profilesetting.loginIpRanges;
    }
    if (profilesetting.userPermissions){
        profile["userPermissions"] = profilesetting.userPermissions;
    }
    //applicationVisibilities
    profile.applicationVisibilities = [];
    if (fs.existsSync(profilepath+'/applicationVisibilities')) {
        fs.readdirSync(profilepath+'/applicationVisibilities').forEach(file => {
            profile.applicationVisibilities.push(JSON.parse(fs.readFileSync(profilepath+'/applicationVisibilities/'+file).toString()));
        });
    }
    //classAccess
    profile.classAccesses = [];
    if (fs.existsSync(profilepath+'/classAccesses')) {
        fs.readdirSync(profilepath+'/classAccesses').forEach(file => {
            profile.classAccesses.push(JSON.parse(fs.readFileSync(profilepath+'/classAccesses/'+file).toString()));
        });
    }
    //customSettingAccesses
    profile.customSettingAccesses = [];
    if (fs.existsSync(profilepath+'/customSettingAccesses')) {
        fs.readdirSync(profilepath+'/customSettingAccesses').forEach(file => {
            profile.customSettingAccesses.push(JSON.parse(fs.readFileSync(profilepath+'/customSettingAccesses/'+file).toString()));
        });
    }
    //externalDataSourceAccesses
    profile.externalDataSourceAccesses = [];
    if (fs.existsSync(profilepath+'/externalDataSourceAccesses')) {
        fs.readdirSync(profilepath+'/externalDataSourceAccesses').forEach(file => {
            profile.externalDataSourceAccesses.push(JSON.parse(fs.readFileSync(profilepath+'/externalDataSourceAccesses/'+file).toString()));
        });
    }
    //flowAccesses
    profile.flowAccesses = [];
    if (fs.existsSync(profilepath+'/flowAccesses')) {
        fs.readdirSync(profilepath+'/flowAccesses').forEach(file => {
            profile.flowAccesses.push(JSON.parse(fs.readFileSync(profilepath+'/flowAccesses/'+file).toString()));
        });
    }
    //categoryGroupVisibilities
    profile.categoryGroupVisibilities = [];
    if (fs.existsSync(profilepath+'/categoryGroupVisibilities')) {
        fs.readdirSync(profilepath+'/categoryGroupVisibilities').forEach(file => {
            profile.categoryGroupVisibilities.push(JSON.parse(fs.readFileSync(profilepath+'/categoryGroupVisibilities/'+file).toString()));
        });
    }
    //customMetadataTypeAccesses
    profile.customMetadataTypeAccesses = [];
    if (fs.existsSync(profilepath+'/customMetadataTypeAccesses')) {
        fs.readdirSync(profilepath+'/customMetadataTypeAccesses').forEach(file => {
            profile.customMetadataTypeAccesses.push(JSON.parse(fs.readFileSync(profilepath+'/customMetadataTypeAccesses/'+file).toString()));
        });
    }
    //customPermissions
    profile.customPermissions = [];
    if (fs.existsSync(profilepath+'/customPermissions')) {
        fs.readdirSync(profilepath+'/customPermissions').forEach(file => {
            profile.customPermissions.push(JSON.parse(fs.readFileSync(profilepath+'/customPermissions/'+file).toString()));
        });
    }
    //objects
    profile.objectPermissions = [];
    profile.fieldPermissions = [];
    profile.recordTypeVisibilities = [];
    if (fs.existsSync(profilepath+'/objectPermissions')) {
        fs.readdirSync(profilepath+'/objectPermissions').forEach(file => {
            var objectpath = profilepath+'/objectPermissions/'+file;
            //objectPermissions
            if (fs.existsSync(objectpath+'/'+file+'.json')){
                profile.objectPermissions.push(JSON.parse(fs.readFileSync(objectpath+'/'+file+'.json').toString()));
            }
            //fieldPermissions
            if (fs.existsSync(objectpath+'/fieldPermissions')){
                fs.readdirSync(objectpath+'/fieldPermissions').forEach(file => {
                    profile.fieldPermissions.push(JSON.parse(fs.readFileSync(objectpath+'/fieldPermissions/'+file).toString()));
                });
            }
            //recordTypeVisibilities
            if (fs.existsSync(objectpath+'/recordTypeVisibilities')){
                fs.readdirSync(objectpath+'/recordTypeVisibilities').forEach(file => {
                    profile.recordTypeVisibilities.push(JSON.parse(fs.readFileSync(objectpath+'/recordTypeVisibilities/'+file).toString()));
                });
            }
        });
    }
    //layoutAssignments
    profile.layoutAssignments = [];
    if (fs.existsSync(profilepath+'/layoutAssignments')) {
        fs.readdirSync(profilepath+'/layoutAssignments').forEach(file => {
            profile.layoutAssignments.push(JSON.parse(fs.readFileSync(profilepath+'/layoutAssignments/'+file).toString()));
        });
    }
    //pageAccesses
    profile.pageAccesses = [];
    if (fs.existsSync(profilepath+'/pageAccesses')) {
        fs.readdirSync(profilepath+'/pageAccesses').forEach(file => {
            profile.pageAccesses.push(JSON.parse(fs.readFileSync(profilepath+'/pageAccesses/'+file).toString()));
        });
    }
    //tabVisibilities
    profile.tabVisibilities = [];
    if (fs.existsSync(profilepath+'/tabVisibilities')) {
        fs.readdirSync(profilepath+'/tabVisibilities').forEach(file => {
            profile.tabVisibilities.push(JSON.parse(fs.readFileSync(profilepath+'/tabVisibilities/'+file).toString()));
        });
    }
    var xml = js2xmlparser.parse("Profile", profile, { declaration: { encoding: 'UTF-8' }});
    fs.writeFileSync(sourcepath+'/'+profilename+'.profile-meta.xml', xml);
}

export default class PofileBuild extends SfdxCommand {

    public static description = 'Convert profile xml into small chunks of json files';
  
    public static examples = [
        `$ sfdx dxb:profile:build`,
        `$ sfdx dxb:profile:build -p Admin -r src/profiles`
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        profilename : flags.string({char:'p',description:'Profile name to be converted'}),
        sourcepath: flags.string({ char: 'r', description: 'Path to profile files', default: 'force-app/main/default/profiles' })
    };
  
    public async run() {
        var profilename = this.flags.profilename;
        sourcepath = this.flags.sourcepath;
        if (profilename){
            buildProfile(profilename);    
        }else{
            fs.readdirSync(sourcepath).forEach(file => {
                if (file.indexOf('profile-meta.xml') >= 0){
                    profilename = file.split('.')[0];
                    buildProfile(profilename);
                }
            });
        }
    }
}