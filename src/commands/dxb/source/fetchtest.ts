import * as path from 'path';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import * as fs from 'fs-extra';
import { getComponentsFromManifest } from '../../../utils/utils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'source.fetchtest');

export type SourceFetchtestResult = {
  result: string[];
};

export default class SourceFetchtest extends SfCommand<SourceFetchtestResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'source-path': Flags.string({
      char: 'p',
      summary: messages.getMessage('flags.source-path.summary'),
      multiple: true,
      aliases: ['sourcepath'],
      deprecateAliases: true,
    }),
    manifest: Flags.file({ char: 'x', summary: messages.getMessage('flags.manifest.summary'), exists: true }),
    'metadata-type': Flags.string({
      char: 't',
      summary: messages.getMessage('flags.metadata-type.summary'),
      default: ['objects', 'classes', 'workflows'],
      multiple: true,
      aliases: ['metatype'],
      deprecateAliases: true,
    }),
    'base-dir': Flags.string({
      char: 'd',
      summary: messages.getMessage('flags.base-dir.summary'),
      default: 'force-app/main/default',
      aliases: ['basedir'],
      deprecateAliases: true,
    }),
    'test-class-name-regex': Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.test-class-name-regex.summary'),
      default: '.*Test',
      aliases: ['testclsnameregex'],
      deprecateAliases: true,
    }),
  };

  private basedir = '';
  private testClasses: string[] = [];
  private regex = '';
  private processedClasses: string[] = [];
  private allClasses: string[] = [];

  public async run(): Promise<SourceFetchtestResult> {
    const { flags } = await this.parse(SourceFetchtest);
    const sourcepath = flags['source-path'];
    const manifest = flags.manifest;
    if (sourcepath === undefined && manifest === undefined) {
      throw messages.createError('error.requiredFlags');
    }
    const metadatatypes = flags['metadata-type'];
    this.regex = flags['test-class-name-regex'];
    this.basedir = flags['base-dir'];
    // retrieve all classes
    this.allClasses = this.getAllClasses(this.basedir).flat();
    let result = [];
    // go through delta changes
    if (manifest) {
      result = await this.processFromPackageXmlContent(manifest);
    } else {
      result = this.processFromArgument(sourcepath!, metadatatypes);
    }
    result?.forEach(this.printResult);
    return { result };
  }

  public getAllClasses(directory: string): string[] | string[][] {
    const currentDirectorypath = path.join(directory);

    const currentDirectory = fs.readdirSync(currentDirectorypath, { encoding: 'utf8' });

    return currentDirectory.map((file: string) => {
      const pathOfCurrentItem: string = path.join(directory + '/' + file);
      if (fs.statSync(pathOfCurrentItem).isFile() && file.endsWith('.cls')) {
        return [pathOfCurrentItem];
      } else if (!fs.statSync(pathOfCurrentItem).isFile()) {
        const directorypath = path.join(directory + '/' + file);
        return this.getAllClasses(directorypath).flat();
      } else {
        return [];
      }
    });
  }
  protected processFromArgument(sourcepath: string[], metadatatypes: string[]): string[] {
    sourcepath.forEach((file: any) => {
      file = path.parse(file);
      metadatatypes.forEach((type: string) => {
        if (file.dir.endsWith(type)) {
          if (
            (type === 'classes' && file.base.endsWith('cls')) ||
            type === 'workflows' ||
            (type === 'objects' && file.base.endsWith('object-meta.xml'))
          ) {
            this.getTestClasses(path.join(this.basedir, 'classes'), type, file.name);
          } else if (
            type === 'objects' &&
            (file.base.endsWith('field-meta.xml') || file.base.endsWith('validationRule-meta.xml'))
          ) {
            const parentfolder = path.normalize(path.join(file.dir, '..'));
            this.getTestClasses(path.join(this.basedir, 'classes'), type, path.parse(parentfolder).name);
          }
        }
      });
    });
    return this.testClasses;
  }
  protected async processFromPackageXmlContent(manifest: string): Promise<string[]> {
    try {
      const classPath = path.join(this.basedir, 'classes');
      (await getComponentsFromManifest(manifest, 'ApexClass')).forEach((member) =>
        this.getTestClasses(classPath, 'classes', member)
      );

      return this.testClasses;
    } catch (err) {
      throw messages.createError('error.processManifest');
    }
  }

  private getTestClasses(classpath: string, type: string, element: string): string[] | string[][] {
    // check if the element is a test classes
    if (
      type === 'classes' &&
      !this.testClasses.includes(element) &&
      element.search(new RegExp(this.regex, 'gmui')) >= 0
    ) {
      this.testClasses.push(element);
      return [];
    }
    // do we have a sibling test class with same name ?
    const siblingTestClass = this.allClasses.find((f) => f.search(element + 'Test') >= 0);
    if (siblingTestClass) {
      const file: path.ParsedPath = path.parse(siblingTestClass);
      if (!this.testClasses.includes(file.name)) {
        this.testClasses.push(file.name);
      }
    }
    // go through each classes and check if element is referenced in the file content (case senstive ?!)
    return this.allClasses.map((f) => {
      const file: path.ParsedPath = path.parse(f);
      if (!this.testClasses.includes(file.name)) {
        const content = fs.readFileSync(f).toString();
        if (content.includes(element) && !this.processedClasses.includes(file.name)) {
          // make sure we don't re-process a class already processed
          this.processedClasses.push(file.name);
          return this.getTestClasses(classpath, 'classes', file.name).flat();
        } else {
          return [];
        }
      } else {
        return [];
      }
    });
  }

  private printResult = (result: string): void => {
    this.log(result);
  }
}
