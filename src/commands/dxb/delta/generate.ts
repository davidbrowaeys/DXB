import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import * as extensions from '../../../lib/delta_dependencies.json';

const fs = require("fs-extra");
const path = require('path');
const exec = require('child_process').execSync;

function onlyUnique(value, index, self) { 
  return self.indexOf(value) === index;
}

function copyFileSync( source: string, target: string ) {
  var targetFile = target;

  //if target is a directory a new file with the same name will be created
  if ( fs.existsSync( target ) ) {
    if ( fs.lstatSync( target ).isDirectory() ) {
      targetFile = path.join( target, path.basename( source ) );
    }
  }
  console.log(targetFile);
  fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync( source: string, target: string ) {
  var files = [];

  //check if folder needs to be created or integrated
  var targetFolder = path.join( target, path.basename( source ) );
  if ( !fs.existsSync( targetFolder ) ) {
    fs.ensureDirSync( targetFolder );
  }

  //copy
  if ( fs.lstatSync( source ).isDirectory() ) {
    files = fs.readdirSync( source );
    files.forEach( function ( file ) {
      var curSource = path.join( source, file );
      if ( fs.lstatSync( curSource ).isDirectory() ) {
        copyFolderRecursiveSync( curSource, targetFolder );
      } else {
        copyFileSync( curSource, targetFolder );
      }
    } );
  }
}

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('dxb', 'generate');

export default class DeltaGenerate extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx dxb:delta:generate -r delta -m tags
  <list of all files changed from latest commit to head>
  `,
  `$ sfdx dxb:delta:generate -r delta -m commitid -c 123456
  <list of all files changed for a specific commit>
  `,
  `$ sfdx dxb:delta:generate -r delta -m branch -b origin/master
  <list of all files changed from latest commit to head>
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    targetdir:flags.string({char: 'r',description: 'delta|acc_delta|...'}),
    mode: flags.string({char: 'm',description: 'commitid(default)|tags|branch'}),
    commitid: flags.string({char: 'c', description: 'commit #'}),
    branch:flags.string({char: 'b',description: 'branch name to compare with, origin/develop'}),
    prevtag: flags.string({char: 'p', description: 'tag # to HEAD'})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run() {
    const commitid = this.flags.commitid ;
    const mode = this.flags.mode || 'commitid';
    const prevtag = this.flags.prevtag;
    const branch = this.flags.branch;
    const targetdir = this.flags.targetdir || 'delta';
    
    if (!fs.existsSync(targetdir)){ 
      fs.mkdirSync(targetdir);
    }
    fs.copyFileSync('sfdx-project.json',path.join(targetdir,'sfdx-project.json')); 
    this.ux.log(path.join(targetdir,'sfdx-project.json'));
    fs.copyFileSync('.forceignore',path.join(targetdir,'.forceignore')); 
    this.ux.log(path.join(targetdir,'.forceignore'));

    //git diff-tree --no-commit-id --name-only -r 2d9dc0fd1f5148b9f4dac23215c4aaaae64c1ab1
    var gitresult;
    if (mode === 'branch'){
      gitresult = exec(`git diff ${branch} --name-only`).toString().split('\n');
    }else if (mode === 'tags'){
      if (prevtag) {
        gitresult = exec(`git diff $(git describe --match ${prevtag}* --abbrev=0 --all)..HEAD --name-only`).toString().split('\n');
      }else{
        gitresult = exec(`git diff $(git describe --tags --abbrev=0 --all)..HEAD --name-only`).toString().split('\n');
      }
    }else{
      gitresult = exec(`git diff-tree --no-commit-id --name-only -r ${commitid}`).toString().split('\n'); //this only work with specific commit ids, how to get file that changed since last tag ? 
    }

    var files = gitresult.filter( onlyUnique );

    for(var i in files){
      var f = files[i];
      if (!f || f == '' || f.indexOf('force-app') < 0) continue;
      
      var basedir = 'force-app/main/default'; //store base folder (force-app) into dxb cli config json file so we can easily change it 
      if (fs.existsSync(f) && !fs.existsSync(path.join(targetdir,f))){ 

        var file = path.parse(f);
        fs.ensureDirSync(path.join(targetdir,file.dir)); //create folder to accept file (including ${targetdir} or acc???)
        
        if (fs.existsSync(f)){
          fs.copyFileSync(f,path.join(targetdir,f)); //copy original file
          this.ux.log(path.join(targetdir,f));
        }
        var fileext = file.base.substring(file.base.indexOf('.') + 1);
        var foldername = file.dir.replace(basedir+'/','');
        if (foldername.indexOf('/') >= 0){
          foldername = foldername.split('/')[0];
        }		

        if (foldername === 'staticresources'){
          fs.readdirSync( file.dir ).forEach( function ( fname ) {
            if (fname.indexOf(file.name+'.') >= 0){
              var fileTocopy = path.join(file.dir,fname);
              if (fs.existsSync(fileTocopy)) copyFileSync(fileTocopy,path.join(targetdir,fileTocopy));		
            }
          });
        }else if (extensions[foldername] !== undefined && extensions[foldername][fileext] !== undefined){
          var copyExt = extensions[foldername][fileext]; //base on the file extension, find its extension dependnedies, i.e.: if .cl change, it should include .cls-meta.xml
          if (copyExt){	//if an dependant extension exist, then do the  below otherwise end of process, nothing need to be done
            if (copyExt === '..'){	//2 dots (..) means we are looking at copying the parent folder, i.e.: object 
              var parentfolder = path.normalize(path.join(file.dir,'..')); //copy whole folder
              copyFolderRecursiveSync(file.dir,path.join(targetdir,parentfolder));
            }else if (copyExt.indexOf('..') >= 0){ //what if copy file = ../../../object-meta.xml?
              var parentfolder = path.normalize(path.join(file.dir,'..'));
              copyFolderRecursiveSync(parentfolder,path.join(targetdir,parentfolder,'..'));
            }else{
              var fileTocopy = path.join(file.dir,file.name+'.'+copyExt); //copy direct meta file
              if (fs.existsSync(fileTocopy)) copyFileSync(fileTocopy,path.join(targetdir,fileTocopy));
            }
          }
        }
      }
  	}
	}
}