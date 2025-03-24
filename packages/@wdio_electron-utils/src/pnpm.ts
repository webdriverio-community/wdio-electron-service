import path from 'node:path';
import fs from 'node:fs/promises';

import log from './log';

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
  const electronCatalogName = pkgElectronVersion?.split('catalog:')[1]?.trim();
  const electronNightlyCatalogName = pkgElectronNightlyVersion?.split('catalog:')[1]?.trim();
  log.debug('Locating pnpm-workspace.yaml...');

  try {
    // Traverse up the directory tree to find pnpm-workspace.yaml
    let currentDir = projectDir;
    let workspaceYamlPath;
    let yamlContent;

    while (currentDir !== path.parse(currentDir).root) {
      workspaceYamlPath = path.join(currentDir, 'pnpm-workspace.yaml');
      try {
        yamlContent = await fs.readFile(workspaceYamlPath, 'utf8');
        log.debug(`Found pnpm-workspace.yaml at ${workspaceYamlPath}`);
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
      { packageName: 'electron', catalogName: electronCatalogName, versionString: pkgElectronVersion },
      {
        packageName: 'electron-nightly',
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
      if (versionString === 'catalog:' && pnpmWorkspace.catalog?.[packageName]) {
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
