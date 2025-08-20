import fs from 'node:fs/promises';
import path from 'node:path';
import { PNPM_CATALOG_PREFIX, PNPM_WORKSPACE_YAML } from './constants.js';
import { createLogger } from './log.js';

const log = createLogger('utils');

type PnpmWorkspace = {
  catalog?: { [key: string]: string };
  catalogs?: { [key: string]: { [key: string]: string } };
};

let _projectDir: string | undefined;
let pnpmWorkspace: PnpmWorkspace | undefined;

export async function findPnpmCatalogVersion(pkgName: string, pkgVersion: string, projectDir?: string) {
  if (!projectDir) {
    return undefined;
  }

  // Determine catalog names
  const electronCatalogName = pkgVersion?.split(PNPM_CATALOG_PREFIX)[1]?.trim();
  log.debug(`Locating ${PNPM_WORKSPACE_YAML}...`);

  try {
    // Traverse up the directory tree to find pnpm-workspace.yaml
    let currentDir = projectDir;
    let workspaceYamlPath: string | undefined;
    let yamlContent: string | undefined;
    if (!pnpmWorkspace || _projectDir !== projectDir) {
      _projectDir = projectDir;
      while (currentDir !== path.parse(currentDir).root) {
        workspaceYamlPath = path.join(currentDir, PNPM_WORKSPACE_YAML);
        try {
          yamlContent = await fs.readFile(workspaceYamlPath, 'utf8');
          log.debug(`Found ${PNPM_WORKSPACE_YAML} at ${workspaceYamlPath}`);
          break;
        } catch (_e) {
          // Move up one directory
          currentDir = path.dirname(currentDir);
        }
      }
      if (!yamlContent) {
        return undefined;
      }
      pnpmWorkspace = (await import('yaml')).parse(yamlContent) as PnpmWorkspace;
    }

    // Handle named catalog
    if (electronCatalogName && pnpmWorkspace.catalogs?.[electronCatalogName]?.[pkgName]) {
      return pnpmWorkspace.catalogs[electronCatalogName][pkgName];
    }

    // Handle default catalog
    if (pkgVersion === PNPM_CATALOG_PREFIX && pnpmWorkspace.catalog?.[pkgName]) {
      return pnpmWorkspace.catalog[pkgName];
    }

    return undefined;
  } catch (error) {
    // Gracefully handle other errors
    log.debug(`Error finding pnpm workspace: ${(error as Error).message}`);
    return undefined;
  }
}
