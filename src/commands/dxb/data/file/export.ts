import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Connection, Messages } from '@salesforce/core';
import * as fs from 'fs-extra';
import { Record, SObject, SObjectFieldType, Schema } from 'jsforce';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'data.file.export');

export type DataFileExportResult = {
  failedDownloads: string[];
};

type SObjectResult = {
  [name: string]: SObjectFieldType | null;
} & Record;

function sanitizeFileName(fileName: string): string {
  // List of invalid characters in Windows file names
  const invalidCharsRegex = /[<>:"/\\|?*\x20-\u{20}/u]/g;

  // Replace invalid characters with an empty string
  const sanitizedFileName = fileName.replaceAll(invalidCharsRegex, '');

  return sanitizedFileName;
}

function delay(ms: number): Promise<any> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default class DataFileExport extends SfCommand<DataFileExportResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'file-path': Flags.file({
      exists: true,
      char: 'f',
      summary: messages.getMessage('flags.file-path.summary'),
      default: './input.csv',
      aliases: ['filepath'],
      deprecateAliases: true,
    }),
    min: Flags.integer({
      char: 'm',
      summary: messages.getMessage('flags.min.summary'),
    }),
    max: Flags.integer({
      char: 't',
      summary: messages.getMessage('flags.max.summary'),
    }),
  };

  public failedDownloads: string[] = [];
  protected connection: Connection | undefined;

  public async run(): Promise<DataFileExportResult> {
    const { flags } = await this.parse(DataFileExport);
    const min = flags.min;
    const max = flags.max;
    const file = fs.readFileSync(flags['file-path']).toString();
    const regex = /[,\n\r]+/;
    const contentDocumentIds = file.split(regex);
    this.log(messages.getMessage('log.numberToExtract', [contentDocumentIds.length]));
    this.connection = flags['target-org']?.getConnection();

    await this.downloadFiles(min && max ? contentDocumentIds.slice(min, max) : contentDocumentIds);
    return { failedDownloads: this.failedDownloads };
  }

  public async downloadFiles(fileBodyIds: string[]): Promise<void> {
    const downloadPromises = fileBodyIds.map((fileBodyId) => this.downloadFile(fileBodyId, 3));

    try {
      await Promise.all(downloadPromises);
      this.log(messages.getMessage('log.successful'));
    } catch (error) {
      this.log(messages.getMessage('error.failedDownloads', [(error as Error).message]));
    }
  }

  public async downloadFile(contentDocumentId: string, retry: number): Promise<void> {
    try {
      await delay(500);
      const contentDocument: SObject<Schema, 'ContentDocument'> | undefined =
        this.connection?.sobject('ContentDocument');
      const docResult: SObjectResult | undefined = await contentDocument?.retrieve(contentDocumentId, {
        fields: ['LatestPublishedVersionId', 'Title'],
      });
      this.log(docResult?.Title);
      const contentVersion: SObject<Schema, 'ContentVersion'> | undefined = this.connection?.sobject('ContentVersion');
      const contentVersionId: string = docResult?.LatestPublishedVersionId;
      const result: SObjectResult | undefined = await contentVersion?.retrieve(contentVersionId, {
        fields: ['PathOnClient', 'VersionDataUrl'],
      });
      this.log(result?.PathOnClient);
      this.log(result?.VersionData);
      const response: Response = await fetch(
        (this.connection?.instanceUrl ?? '') + '/' + (result?.VersionData as string),
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.connection?.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        messages.createError('error.failedToDownload', [response.status]);
      }
      const contentType = response.headers.get('content-type');
      const fileBlob = await response.blob();

      const blob = new Blob([fileBlob], { type: contentType ?? '' });
      const fileStream: fs.WriteStream = fs.createWriteStream(
        `./files/${contentDocumentId}_${sanitizeFileName(result?.PathOnClient)}`
      );
      fileStream.write(Buffer.from(await new Response(blob).arrayBuffer()));

      return await new Promise((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
      });
    } catch (err) {
      this.log(messages.getMessage('error.contentVersionError', [contentDocumentId]));
      if (retry >= 0) {
        return await this.downloadFile(contentDocumentId, retry - 1);
      }
      this.failedDownloads.push(contentDocumentId); // Store the failed contentDocumentId;
    }
    return;
  }
}
