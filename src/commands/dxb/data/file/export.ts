import { flags, SfdxCommand } from "@salesforce/command";
import { Connection } from "@salesforce/core";
import * as fs from "fs";

function sanitizeFileName(fileName) {
  // List of invalid characters in Windows file names
  const invalidCharsRegex = /[<>:"\/\\|?*\x00-\x1F]/g;

  // Replace invalid characters with an empty string
  const sanitizedFileName = fileName.replaceAll(invalidCharsRegex, "");

  return sanitizedFileName;
}

// import * as path from 'path';
// import {createObjectCsvWriter as createCsvWriter} from 'csv-writer';

export default class DataTransferExport extends SfdxCommand {
  public static description =
    "Export data from an org base on dxb data plan definition file.";

  public static examples = [`$ sfdx dxb:data:file:export -o myorg`];

  public static args = [{ name: "file" }];

  protected static flagsConfig = {
    filepath: flags.string({
      char: "f",
      description: "path to file containing all content document id's",
      default: "."
    }),
    min: flags.number({
      char: "m",
      description: "minimum offset"
    }),
    max: flags.number({
      char: "t",
      description: "maximum offset"
    })
  };
  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  protected connection: Connection;
  protected outputdir: string;
  protected csvWriter: any;
  protected querylimit: number;
  public failedDownloads = [];
  public async run() {
    const min = this.flags.min;
    const max = this.flags.max;
    const file = fs.readFileSync(this.flags.filepath).toString();
    const regex = /[,\n\r]+/;
    const contentDocumentIds = file.split(regex);
    console.log("Number of files to extract:", contentDocumentIds.length);
    this.connection = this.org.getConnection();

    this.downloadFiles(
      min && max ? contentDocumentIds.slice(min, max) : contentDocumentIds
    );
    console.log(this.failedDownloads);
  }
  public async downloadFiles(fileBodyIds: string[]) {
    const downloadPromises = fileBodyIds.map((fileBodyId) =>
      this.downloadFile(fileBodyId, 3)
    );

    try {
      await Promise.all(downloadPromises);
      console.log("All files downloaded successfully.");
    } catch (error) {
      console.error("Failed to download files:", error);
    }
  }
  public docResult;
  public async downloadFile(contentDocumentId, retry) {
    try {
      await this.delay(500);
      const contentDocument: any = this.connection.sobject("ContentDocument");
      this.docResult = await contentDocument.retrieve(contentDocumentId, [
        "LatestPublishedVersionId",
        "Title"
      ]);
      console.log(this.docResult.Title);
      const contentVersion: any = this.connection.sobject("ContentVersion");
      const result = await contentVersion.retrieve(
        this.docResult.LatestPublishedVersionId,
        ["PathOnClient", "VersionDataUrl", "VersionDataUrl"]
      );
      console.log(result.PathOnClient);
      console.log(result.VersionData);
      const response: any = await fetch(
        this.connection.instanceUrl + "/" + result.VersionData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.connection.accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to download file. Status code: ${response.status}`
        );
      }
      const contentType = response.headers.get("content-type");
      const fileBuffer = await response.arrayBuffer();

      const blob = new Blob([fileBuffer], { type: contentType });
      const fileStream: any = fs.createWriteStream(
        `./files/${contentDocumentId}_${sanitizeFileName(result.PathOnClient)}`
      );
      fileStream.write(Buffer.from(await new Response(blob).arrayBuffer()));

      return new Promise((resolve, reject) => {
        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
      });
    } catch (err) {
      console.log(`Content Version Error for ${contentDocumentId}!`);
      if (retry >= 0) {
        return await this.downloadFile(contentDocumentId, retry - 1);
      }
      this.failedDownloads.push(contentDocumentId); // Store the failed contentDocumentId;
    }
    return null;
  }
  public delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
