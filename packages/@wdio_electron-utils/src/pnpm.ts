import path from 'node:path';
import fs from 'node:fs/promises';

import log from './log';
import { PKG_NAME_ELECTRON, PNPM_CATALOG_PREFIX, PNPM_WORKSPACE_YAML } from './constants';

type PnpmWorkspace = {
  catalog?: { [key: string]: string };
  catalogs?: { [key: string]: { [key: string]: string } };
};

export async function findPnpmCatalogVersion(
  pkgElectronVersion?: string,
  pkgElectronNightlyVersion?: string,
  projectDir?: string,
) {
  if (!projectDir) {
    return undefined;
  }

  // Determine catalog names
  const electronCatalogName = pkgElectronVersion?.split(PNPM_CATALOG_PREFIX)[1]?.trim();
  const electronNightlyCatalogName = pkgElectronNightlyVersion?.split(PNPM_CATALOG_PREFIX)[1]?.trim();
  log.debug(`Locating ${PNPM_WORKSPACE_YAML}...`);

  try {
    // Traverse up the directory tree to find pnpm-workspace.yaml
    let currentDir = projectDir;
    let workspaceYamlPath;
    let yamlContent;

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

    const pnpmWorkspace = (await import('yaml')).parse(yamlContent) as PnpmWorkspace;
    const checks = [
      { packageName: PKG_NAME_ELECTRON.STABLE, catalogName: electronCatalogName, versionString: pkgElectronVersion },
      {
        packageName: PKG_NAME_ELECTRON.NIGHTLY,
        catalogName: electronNightlyCatalogName,
        versionString: pkgElectronNightlyVersion,
      },
    ];

    for (const { packageName, catalogName, versionString } of checks) {
      // Handle named catalog
      if (catalogName && pnpmWorkspace.catalogs?.[catalogName]?.[packageName]) {
        return pnpmWorkspace.catalogs[catalogName][packageName];
      }

      // Handle default catalog
      if (versionString === PNPM_CATALOG_PREFIX && pnpmWorkspace.catalog?.[packageName]) {
        return pnpmWorkspace.catalog[packageName];
      }
    }
    return undefined;
  } catch (error) {
    // Gracefully handle other errors
    log.debug(`Error finding pnpm workspace: ${(error as Error).message}`);
    return undefined;
  }
}
