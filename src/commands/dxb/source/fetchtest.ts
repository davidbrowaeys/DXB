import { flags, SfdxCommand } from '@salesforce/command';
import * as fs from 'fs-extra';
import * as path from 'path';

let basedir: string;
export default class extends SfdxCommand {

  public static description = 'This command calculated specified test classes base on source path.';

  public static examples = [
    `$ sfdx dxb:source:fetchtest -p "force-app/main/default/profiles/Sales Consultant.profile-meta.xml`,
    `$ sfdx dxb:source:fetchtest -p "force-app/main/default/profiles/Sales Consultant.profile-meta.xml" -t classes`,
    `$ sfdx dxb:source:fetchtest -p "force-app/main/default/profiles/Sales Consultant.profile-meta.xml" -n ".*Test"`
  ];

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    sourcepath: flags.string({ char: 'p', description: 'source path'}),
    metatype: flags.string({ char: 't', description: 'metatype comma separated, i.e.: objects,classes,workflows', default: 'objects,classes,workflows' }),
    basedir: flags.string({ char: 'd', description: 'path of base directory', default: 'force-app/main/default' }),
    testclsnameregex: flags.string({ char: 'n', description: 'Regex for test classes naming convention', default: '.*Test' })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  protected testClasses: string[] = [];
  protected allClasses: string[] = [];
  protected processedClasses: string[] = [];
  protected regex;
  public async run() {
    let sourcepath = this.flags.sourcepath;
    let metatypes = this.flags.metatype.split(',');
    this.regex = this.flags.testclsnameregex;
    basedir = this.flags.basedir;

    let deltaMeta = sourcepath.split(',');
    //retrieve all classes
    this.getAllClasses(basedir);
    //go through delta changes
    deltaMeta.forEach((file: any) => {
      file = path.parse(file);
      metatypes.forEach((type: string) => {
        if (file.dir.endsWith(type)) {
          if ((type === 'classes' && file.base.endsWith('cls')) || type === 'workflows' || (type === 'objects' && file.base.endsWith('object-meta.xml'))) {
            this.getTestClasses(path.join(basedir, 'classes'), type, file.name);
          } else if (type === 'objects' && (file.base.endsWith('field-meta.xml') || file.base.endsWith('validationRule-meta.xml'))) {
            var parentfolder = path.normalize(path.join(file.dir, '..'));
            this.getTestClasses(path.join(basedir, 'classes'), type, path.parse(parentfolder).name);
          }
        }
      });
    });
    if (this.testClasses && this.testClasses.length > 0) {
      this.ux.log(` -r "${this.testClasses.join(',')}"`);
    }
    return { testClasses: this.testClasses }
  }
  private getTestClasses(classpath: string, type: string, element: string) {
    //check if the element is a test classes
    if (type === 'classes' && !this.testClasses.includes(element) && element.search(this.regex) >= 0) {
      this.testClasses.push(element);
      return;
    }
    //go through each classes and check if element is referenced in the file content (case senstive ?!)
    this.allClasses.forEach(f => {
      let file: any = path.parse(f);
      if (!this.testClasses.includes(file.name)) {
        var content = fs.readFileSync(f).toString();
        if (content.indexOf(element) >= 0 && !this.processedClasses.includes(file.name)) { //make sure we don't re-process a class already processed
          this.processedClasses.push(file.name);
          this.getTestClasses(classpath, 'classes', file.name);
        }
      }
    });
  }

  public getAllClasses(directory: string) {
    var currentDirectorypath = path.join(directory);

    var currentDirectory = fs.readdirSync(currentDirectorypath, 'utf8');

    currentDirectory.forEach((file: string) => {
      var pathOfCurrentItem: string = path.join(directory + '/' + file);
      if (fs.statSync(pathOfCurrentItem).isFile() && file.endsWith('.cls')) {
        this.allClasses.push(pathOfCurrentItem);
      } else if (!fs.statSync(pathOfCurrentItem).isFile()){
        var directorypath = path.join(directory + '/' + file);
        this.getAllClasses(directorypath);
      }
    });
  }
}