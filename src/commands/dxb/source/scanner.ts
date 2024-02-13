import * as path from 'path';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import * as fs from 'fs-extra';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'source.scanner');
type Violation = {
  category: string;
  column: string;
  line: string;
  message: string;
  ruleName: string;
  severity: string;
};
export type SourceScannerResult = {
  result: boolean;
};

export default class SourceScanner extends SfCommand<SourceScannerResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    file: Flags.file({ char: 'f', summary: messages.getMessage('flags.file.summary'), exists: true, required: true }),
    'excluded-files': Flags.string({
      char: 'e',
      summary: messages.getMessage('flags.excluded-files.summary'),
      aliases: ['excludedfiles'],
      deprecateAliases: true,
    }),
    severity: Flags.integer({ char: 's', summary: messages.getMessage('flags.severity.summary'), default: 1 }),
    'high-severity-rules': Flags.string({
      char: 'r',
      summary: messages.getMessage('flags.high-severity-rules.summary'),
      multiple: true,
      aliases: ['highseverityrules'],
      deprecateAliases: true,
    }),
  };

  public static readonly requiresProject = true;

  public async run(): Promise<SourceScannerResult> {
    const { flags } = await this.parse(SourceScanner);
    const config: any = await this.project.resolveProjectConfig();

    const filepath = flags.file;
    const excludedFilesPath = flags['excluded-files'];
    const highseverityrules = flags['high-severity-rules'];

    const severity = flags.severity;

    this.log(messages.getMessage('log.calculating'));
    const results = JSON.parse(fs.readFileSync(filepath).toString());
    const excludedFiles = this.getExcludedFiles(excludedFilesPath);
    let throwError = false;
    results.forEach((elem: { fileName: string; violations: Violation[] }) => {
      let content = '';
      const fileJson: path.ParsedPath = path.parse(elem.fileName);
      if (elem.violations && !excludedFiles.includes(fileJson.name)) {
        elem.violations.forEach((v) => {
          if (
            parseInt(v.severity, 10) <= severity ||
            (highseverityrules?.includes(v.ruleName) ??
              config?.dxb?.highseverityrules?.highseverityrules.includes(v.ruleName))
          ) {
            content += `${fileJson.name}[${v.line} - ${v.column}] - ${v.ruleName}(${v.category}) - Severity(${v.severity}) ${v.message}\n`;
            throwError = true;
          }
        });
      }
      if (content !== '') {
        this.log(content);
      }
    });
    if (throwError) {
      throw messages.createError('error.violations');
    }
    return { result: true };
  }

  // eslint-disable-next-line class-methods-use-this
  private getExcludedFiles(excludedFilesPath: string | undefined): string[] {
    let excludedFiles: string[] = [];
    try {
      if (!excludedFilesPath && fs.existsSync(excludedFilesPath!)) {
        excludedFiles = JSON.parse(fs.readFileSync(excludedFilesPath!).toString());
      } else {
        throw new Error('No files found');
      }
    } catch (err) {
      this.log(messages.getMessage('log.noExcludedFiles'));
    }
    return excludedFiles;
  }
}
