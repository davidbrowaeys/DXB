import { flags, SfdxCommand } from '@salesforce/command';

const fs = require("fs-extra");
const path = require("path");
var testClasses = [];
// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.

export default class DeltaTestRetrieve extends SfdxCommand {

    public static description = 'Retrieve related test class of specified classes directory. This need to be run after dxb:delta:generate.';

    public static examples = [
    `$ sfdx nabx:delta:test:retrieve -r delta/force-app/main/default -t objects,classes`
    ];

    public static args = [{name: 'file'}];

    protected static flagsConfig = {
        targetdir:flags.string({char: 'r',description: 'Path of the class directory', default: 'force-app/main/default'}),
        metatype:flags.string({char: 't',description: 'metatype comma sperated, i.e.: objects/classes', default: 'classes'})
    };

    // Comment this out if your command does not require an org username
    protected static requiresUsername = false;

    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = false;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;

    public async run() {
        const targetdir = this.flags.targetdir;
        const metatype = this.flags.metatype.split(',');
        metatype.forEach( dir => {
            if (fs.existsSync(path.join(targetdir,dir))) {
                var files = fs.readdirSync( path.join(targetdir,dir) );
                var testClasses = [];
                files.forEach( file => {
                    if (!testClasses.includes(file)){
                        if (!file.endsWith("meta.xml")){
                            getDependentTestClasses(file.split('.')[0]);
                        }
                    }
                });
            }
        });
        if(testClasses.length > 0) console.log(testClasses.join(','));
    }
}
function getDependentTestClasses(filename){
    var classpath = './force-app/main/default/classes';
    var files = fs.readdirSync( classpath );
    files.forEach( file => {
        if (file.endsWith(".cls") && !file.endsWith("Test.cls")){
            var content = fs.readFileSync(path.join(classpath,file)).toString();
            if (content.indexOf(filename) >= 0){
                var fn = file.split('.')[0] + 'Test';
                if (!testClasses.includes(fn) && fs.existsSync(path.join(classpath,fn+'.cls'))){
                    testClasses.push(fn);
                }
            }
        }
    });
}
