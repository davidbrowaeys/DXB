import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';

const fs = require('fs');
const path = require('path');
var stdin = require('readline-sync');

function updateContent(content, varName, question, res) {
    if (question) res = stdin.question(question);
    content = content.replace(new RegExp(`{{${varName}}}`, 'g'), res);
    return content;
}

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
export default class ApexClassCreate extends SfdxCommand {

  public static description = 'Create apex classes'

  public static examples = [
  `$ sfdx dxb:apex:class:create -n MySuperBatch -t BatchApexClass
    force-app/main/default/classes/MySuperBatch.cls
    force-app/main/default/classes/MySuperBatch.cls-meta.xml
  `,
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    apiname :flags.string({
        char: 'n',
        required: true,
        description: 'api name of the class'
    }),
    template :flags.string({
        char: 't',
        default: 'Constructor',
        description: 'apex class template, choose one of the following available templates:\nApexClass.cls\nApexClassNoConstructor.cls\nBDDUnitTestApexClass.cls\nBatchApexClass.cls\nControllerExtension.cls\nExceptionApexClass.cls\nHttpCalloutMock.cls\nSchedulableApexClass.cls\nSelectorClass.cls\nServiceClass.cls\nUnitTestApexClass.cls\nUrlRewriterApexClass.cls\nWebServiceMock.cls\nWebserviceClass.cls'
    }),
    apiversion : flags.string({
        char: 'v',
        description: 'Api version of metadata, default to version specified in sfdx-project.json'
    }),
    targetdirectory : flags.string({
        char: 'd',
        default: 'force-app/main/default/classes',
        description: 'directory where it should create the apex class'
    })
  };
  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run() {
      let config = JSON.parse(fs.readFileSync('./sfdx-project.json').toString());
      let apiname = this.flags.apiname;
      let apiversion = this.flags.apiversion ? this.flags.apiversion : config.sourceApiVersion;
      let template = this.flags.template;
      let targetdirectory = this.flags.targetdirectory;
      let templatepath = config.apextemplatepath ? config.apextemplatepath : path.join(__dirname, '../../../../lib/templates/apex');

      if (!fs.existsSync(path.join(templatepath ,template+'.cls'))){
        throw new SfdxError('Template not found');
      }
      //handle cls content
      var content = fs.readFileSync(path.join(templatepath ,template+'.cls')).toString();
      content = updateContent(content, 'api_name', null, apiname);
      //look for extra attributes in def.json
      if (!fs.existsSync(path.join(templatepath ,'def.json'))){
        throw new SfdxError('Missing def.json in template directory.');
      }
      var apexdef = JSON.parse(fs.readFileSync(path.join(templatepath ,'def.json')).toString());
      if (apexdef[template]){
        console.log('We need some extra information in order to create your apex class, please answer the following...');
        apexdef[template].forEach(elem => {
            content = updateContent(content, elem.key, elem.question, null);
        });
      }
      fs.writeFileSync(path.join(targetdirectory,apiname+'.cls'), content);
      console.log(path.join(targetdirectory,apiname+'.cls'));
        //handle meta.xml content
      content = fs.readFileSync(path.join(templatepath ,'apex.cls-meta.xml')).toString();
      content = updateContent(content, 'api_version', null, apiversion);
      content = updateContent(content, 'api_name', null, apiname);
      fs.writeFileSync(path.join(targetdirectory,apiname+'.cls-meta.xml'), content);
      console.log(path.join(targetdirectory,apiname+'.cls-meta.xml'));
  }
}
