import { execSync as exec } from 'child_process';
import * as path from 'path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, PackageDir, SfProject } from '@salesforce/core';
import * as fs from 'fs-extra';
import { getComponentsFromManifest } from '../../../../utils/utils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'lwc.test.run');

export type LwcTestRunResult = {
  result: string;
};

export default class LwcTestRun extends SfCommand<LwcTestRunResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    test: Flags.string({
      summary: messages.getMessage('flags.test.summary'),
      char: 't',
      multiple: true,
      exclusive: ['manifest'],
    }),
    'fail-on-error': Flags.boolean({
      summary: messages.getMessage('flags.fail-on-error.summary'),
      char: 'e',
    }),
    'root-dir': Flags.directory({
      summary: messages.getMessage('flags.root-dir.summary'),
      char: 'd',
      multiple: true,
      exists: true,
    }),
    manifest: Flags.file({
      summary: messages.getMessage('flags.manifest.summary'),
      char: 'x',
      exists: true,
      exclusive: ['test'],
    }),
  };

  protected packageDirectories: PackageDir[] = [];
  protected projectConfig: any;

  public async run(): Promise<LwcTestRunResult> {
    const { flags } = await this.parse(LwcTestRun);
    let components = flags.test;
    if (flags.manifest) {
      components = await this.processFromPackageXmlContent(flags.manifest);
    }

    this.projectConfig = await (await SfProject.resolve()).resolveProjectConfig();
    this.packageDirectories = this.projectConfig.packageDirectories;
    // either use specified root directory or all directories in the sfdx-project.json
    const roots = flags['root-dir'] ?? this.packageDirectories.map((packageDir) => packageDir.path);

    // sanitize input, to ensure specified components to test actually exist
    const validTestNames = roots.reduce((acc: string[], cur: string): string[] => {
      acc.push(...this.sanitize(components, cur));
      return acc;
    }, []);
    if (components && validTestNames.length === 0) {
      throw messages.createError('error.invalidComponents');
    }

    const issues: string | undefined = this.testComponents(validTestNames, roots);
    if (flags['fail-on-error'] && issues) {
      throw messages.createError('error.issues', [issues]);
    } else if (issues) {
      return {
        result: messages.createWarning('warning.issues', [issues]).message,
      };
    } else {
      return {
        result: messages.getMessage('success'),
      };
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private async processFromPackageXmlContent(manifest: string): Promise<string[] | undefined> {
    try {
      const lwcComponents = (await getComponentsFromManifest(manifest, 'LightningComponentBundle')).filter(
        (componentName) => componentName !== '*'
      );
      return lwcComponents.length > 0 ? lwcComponents : undefined;
    } catch (err) {
      throw messages.createError('error.processManifest');
    }
  }

  /**
   * Sanitize input to ensure no malignent calls are made
   *
   * @param specificComponents Contains the names of specific components to test
   * @param root The root directory of the location of the tests
   * @returns the names of test that actually exist or an empty list of none exist
   */
  // eslint-disable-next-line class-methods-use-this
  private sanitize(specificComponents: string[] | undefined, root: string): string[] {
    if (specificComponents) {
      if (!fs.pathExistsSync(path.join(root, 'lwc'))) {
        return fs
          .readdirSync(`${root}`)
          .map((dir) => this.sanitize(specificComponents, path.join(root, dir)))
          .flat();
      }
      const result: string[] = [];
      specificComponents.forEach((compName) => {
        if (fs.pathExistsSync(path.join(root, 'lwc', compName))) {
          result.push(compName);
        }
      });

      return result;
    } else {
      return [];
    }
  }

  /**
   * Runs LWC tests.
   *
   * @param components contains paths to LWC tests to run
   * @returns the errors produced (if any)
   */
  // eslint-disable-next-line class-methods-use-this
  private testComponents(components: string[] | undefined, roots: string[]): string | undefined {
    try {
      exec(
        `sfdx-lwc-jest -- 
        ${
          components ? components.join(' ') : ''
        } --config=jest.config.js --silent --ci --bail=false --json --outputFile=jestOutput.json --roots=${roots.join(
          ' '
        )}`
      );
    } catch (error) {
      return (error as Error).message.split('\n').slice(1).join('\n'); // remove first line to hide implementation details
    }
  }
}
