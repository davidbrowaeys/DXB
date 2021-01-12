import { flags, SfdxCommand } from '@salesforce/command';

const fs = require('fs');
var js2xmlparser = require('js2xmlparser');

function buildProfile(profilename){
    console.log(profilename);
    var profilepath = './force-app/main/default/profiles/'+profilename;
    //profile
    var profilesetting = JSON.parse(fs.readFileSync(profilepath+'/'+profilename+'.json').toString());

    var profile:any = {
        '@': { xmlns: 'http://soap.sforce.com/2006/04/metadata' },
        'custom' : profilesetting.custom,
        'userLicense' : profilesetting.userLicense
    };
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
    //loginHours
    profile.loginHours = [];
    if (fs.existsSync(profilepath+'/loginHours')) {
        fs.readdirSync(profilepath+'/loginHours').forEach(file => {
            profile.loginHours.push(JSON.parse(fs.readFileSync(profilepath+'/loginHours/'+file).toString()));
        });
    }

    //userPermissions
    profile.userPermissions = [];
    if (fs.existsSync(profilepath+'/userPermissions')) {
        fs.readdirSync(profilepath+'/userPermissions').forEach(file => {
            profile.userPermissions.push(JSON.parse(fs.readFileSync(profilepath+'/userPermissions/'+file).toString()));
        });
    }
    var xml = js2xmlparser.parse("Profile", profile, { declaration: { encoding: 'UTF-8' }});
    fs.writeFileSync('./force-app/main/default/profiles/'+profilename+'.profile-meta.xml', xml);
}

export default class PofileBuild extends SfdxCommand {

    public static description = 'Convert profile xml into small chunks of json files';
  
    public static examples = [
    `$ sfdx hello:org --targetusername myOrg@example.com --targetdevhubusername devhub@org.com
    Hello world! This is org: MyOrg and I will be around until Tue Mar 20 2018!
    My hub org id is: 00Dxx000000001234
    `,
    `$ sfdx hello:org --name myname --targetusername myOrg@example.com
    Hello myname! This is org: MyOrg and I will be around until Tue Mar 20 2018!
    `
    ];
  
    public static args = [{name: 'file'}];
  
    protected static flagsConfig = {
        profilename : flags.string({char:'p',description:'Profile name to be converted'})
    };
    // Comment this out if your command does not require an org username
    protected static requiresUsername = false;
  
    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;
  
    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;
  
    public async run() {
        var profilename = this.flags.profilename;
        if (profilename){
            buildProfile(profilename);    
        }else{
            fs.readdirSync('./force-app/main/default/profiles').forEach(file => {
                if (file.indexOf('profile-meta.xml') >= 0){
                    profilename = file.split('.')[0];
                    buildProfile(profilename);
                }
            });
        }
        console.log('Profile(s) build successfully!');
    }
}