import { flags, SfdxCommand } from '@salesforce/command';
const fs = require('fs');
const exec = require('child_process').execSync;

export default class MDAPIConvert extends SfdxCommand {

  public static description = 'Override mdapi convert standard behavior that create a dup file if file exist already. Instead it delete old file and remame .dup by actual file';

  public static examples = [
  	`$ sfdx dxb:mdapi:convert -r tmp`
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    outputdir :flags.string({
      char: 'd',
      description: 'the output directory to store the source–formatted files'
    }),
    rootdir :flags.boolean({
      char: 'r',
      required:true,
      description: '(required) the root directory containing the Metadata API–formatted metadata'
    })
  };
  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run() {
    var rootdir = this.flags.rootdir;
    var outputdir = this.flags.outputdir ? '-d ' + this.flags.outputdir : '';

    var output = JSON.parse(exec(`sfdx force:mdapi:convert -r ${rootdir} ${outputdir} --json`).toString());
    output.result.forEach(elem => {
        if (elem.filePath.indexOf('.dup') >= 0){
          var oldPath = elem.filePath.substring(0,elem.filePath.length - 4);
          fs.unlinkSync(oldPath);
          fs.renameSync(elem.filePath, oldPath);
          console.log(oldPath);
        }else{
          console.log(elem.filePath);
        }
    });
  }
}
