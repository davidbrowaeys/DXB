import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError } from '@salesforce/core';
import * as fs from 'fs-extra';
import * as path from 'path';

let basedir: string;
let testClasses: string[] = [];
let regex;
let processedClasses: string[] = [];
let allClasses: string[] = [];
export default class extends SfdxCommand {

	public static description = 'This command calculated specified test classes base on source path. This command is to use after source:delta.';

	public static examples = [
		`$ sfdx dxb:source:fetchtest -p "force-app/main/default/profiles/Sales Consultant.profile-meta.xml`,
		`$ sfdx dxb:source:fetchtest -p "force-app/main/default/profiles/Sales Consultant.profile-meta.xml" -t classes`,
		`$ sfdx dxb:source:fetchtest -p "force-app/main/default/profiles/Sales Consultant.profile-meta.xml" -n ".*Test"`
	];

	public static args = [{ name: 'file' }];

	protected static flagsConfig = {
		sourcepath: flags.string({ char: 'p', description: 'source path, comma separated if multiple' }),
		manifest: flags.string({ char: 'x', description: 'file path for manifest (package.xml) of components to retrieve' }),
		metatype: flags.string({ char: 't', description: 'metatype comma separated, i.e.: objects,classes,workflows', default: 'objects,classes,workflows' }),
		basedir: flags.string({ char: 'd', description: 'path of base directory', default: 'force-app/main/default' }),
		testclsnameregex: flags.string({ char: 'n', description: 'Regex for test classes naming convention', default: '.*Test' })
	};

	public async run() {
		let sourcepath = this.flags.sourcepath;
		let manifest = this.flags.manifest;
		if (sourcepath === undefined && manifest === undefined) {
			throw new SfdxError('sourcepath or manifest is required');
		}
		let metatypes = this.flags.metatype.split(',');
		regex = this.flags.testclsnameregex;
		basedir = this.flags.basedir;
		//retrieve all classes
		this.getAllClasses(basedir);
		//go through delta changes
		if (manifest) {
			await this.processFromPackageXmlContent(manifest);
		} else {
			await this.processFromArgument(sourcepath, metatypes);
		}
	}
	protected async processFromArgument(sourcepath, metatypes) {
		let deltaMeta = sourcepath.split(',');
		deltaMeta.forEach((file: any) => {
			file = path.parse(file);
			metatypes.forEach((type: string) => {
				if (file.dir.endsWith(type)) {
					if ((type === 'classes' && file.base.endsWith('cls')) || type === 'workflows' || (type === 'objects' && file.base.endsWith('object-meta.xml'))) {
						getTestClasses(path.join(basedir, 'classes'), type, file.name);
					} else if (type === 'objects' && (file.base.endsWith('field-meta.xml') || file.base.endsWith('validationRule-meta.xml'))) {
						var parentfolder = path.normalize(path.join(file.dir, '..'));
						getTestClasses(path.join(basedir, 'classes'), type, path.parse(parentfolder).name);
					}
				}
			});
		});
		if (testClasses && testClasses.length > 0) {
			console.log(` -r "${testClasses.join(',')}"`);
		}
	}
	protected async processFromPackageXmlContent(manifest) {
		try {
			return new Promise(function (resolve, reject) {
				var xml2js = require('xml2js');
				fs.readFile(manifest, function (err, data) {
					var parser = new xml2js.Parser({ "explicitArray": false });
					parser.parseString(data, function (err, result) {
						const classPath = path.join(basedir, 'classes');
						if (result.Package.types){
							var metadata_types = Array.isArray(result.Package.types) ? result.Package.types : [result.Package.types];
							metadata_types.forEach(metaType => {
								if (metaType.name === 'ApexClass') {
									if (Array.isArray(metaType.members)) {
										metaType.members.forEach(elem => {
											getTestClasses(classPath, 'classes', elem);
										});
									} else {
										getTestClasses(classPath, 'classes', metaType.members);
									}
								}
							});
							if (testClasses && testClasses.length > 0) {
								console.log(` -r "${testClasses.join(',')}"`);
							}
						}
					});
				});
			});
		} catch (err) {
			throw new SfdxError('Unable to create scratch org!');
		}
	}

	public getAllClasses(directory: string) {
		var currentDirectorypath = path.join(directory);

		var currentDirectory = fs.readdirSync(currentDirectorypath, 'utf8');

		currentDirectory.forEach((file: string) => {
			var pathOfCurrentItem: string = path.join(directory + '/' + file);
			if (fs.statSync(pathOfCurrentItem).isFile() && file.endsWith('.cls')) {
				allClasses.push(pathOfCurrentItem);
			} else if (!fs.statSync(pathOfCurrentItem).isFile()) {
				var directorypath = path.join(directory + '/' + file);
				this.getAllClasses(directorypath);
			}
		});
	}
}

function getTestClasses(classpath: string, type: string, element: string) {
	//check if the element is a test classes
	if (type === 'classes' && !testClasses.includes(element) && element.search(new RegExp(regex, 'gmui')) >= 0) {
		testClasses.push(element);
		return;
	}
	//do we have a sibling test class with same name ? 
	var siblingTestClass = allClasses.find(f => f.search(element + 'Test') >= 0);
	if (siblingTestClass) {
		let file: any = path.parse(siblingTestClass);
		if (!testClasses.includes(file.name)) testClasses.push(file.name);
	}
	//go through each classes and check if element is referenced in the file content (case senstive ?!)
	allClasses.forEach((f) => {
		let file: any = path.parse(f);
		if (!testClasses.includes(file.name)) {
			var content = fs.readFileSync(f).toString();
			if (content.indexOf(element) >= 0 && !processedClasses.includes(file.name)) { //make sure we don't re-process a class already processed
				processedClasses.push(file.name);
				getTestClasses(classpath, 'classes', file.name);
			}
		}
	});
}