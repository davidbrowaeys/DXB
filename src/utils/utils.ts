import * as fs from 'fs-extra';
import * as xml2js from 'xml2js';

/**
 * Processes a manifest file and retrieves the component members
 *
 * @param manifestPath Path to a manifest file
 * @param componentName Name of the component defined in the package.xml in the <name> tag
 * @returns The members of that component as mentioned under the <members> tags
 */
export async function getComponentsFromManifest(manifestPath: string, componentName: string): Promise<string[]> {
  const data = fs.readFileSync(manifestPath);
  const parser = new xml2js.Parser({ explicitArray: false });
  const result = await parser.parseStringPromise(data);
  if (result.Package.types) {
    const metadataTypes: any[] = Array.isArray(result.Package.types) ? result.Package.types : [result.Package.types];
    return metadataTypes
      .filter((elem) => elem.name === componentName)
      .map((elem: { name: string; members: string[] }) => elem.members)
      .flat();
  } else {
    return [];
  }
}
