import { dirname } from 'node:path';
import findVersions from 'find-versions';

import { findPnpmCatalogVersion } from './pnpm';

import type { NormalizedReadResult } from 'read-package-up';

export async function getElectronVersion(pkg: NormalizedReadResult) {
  const { dependencies, devDependencies } = pkg.packageJson;
  const pkgElectronVersion = dependencies?.electron || devDependencies?.electron;
  const pkgElectronNightlyVersion = dependencies?.['electron-nightly'] || devDependencies?.['electron-nightly'];

  let electronVersion;

  if (pkgElectronVersion?.startsWith('catalog') || pkgElectronNightlyVersion?.startsWith('catalog')) {
    // Extract the directory path from the package.json file path
    const projectDir = dirname(pkg.path);
    electronVersion = await findPnpmCatalogVersion(pkgElectronVersion, pkgElectronNightlyVersion, projectDir);
  }

  // If no catalog version was found, use the direct version from package.json
  if (!electronVersion) {
    electronVersion = pkgElectronVersion || pkgElectronNightlyVersion;
  }

  return electronVersion ? findVersions(electronVersion, { loose: true })[0] : undefined;
}
