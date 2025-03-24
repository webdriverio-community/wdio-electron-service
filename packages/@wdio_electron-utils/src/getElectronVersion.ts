import { dirname } from 'node:path';
import findVersions from 'find-versions';

import { findPnpmCatalogVersion } from './pnpm';

import type { NormalizedReadResult } from 'read-package-up';
import { PKG_NAME_ELECTRON, PNPM_CATALOG_PREFIX } from './constants';

export async function getElectronVersion(pkg: NormalizedReadResult) {
  const { dependencies, devDependencies } = pkg.packageJson;
  const pkgElectronVersion = dependencies?.[PKG_NAME_ELECTRON.STABLE] || devDependencies?.[PKG_NAME_ELECTRON.STABLE];
  const pkgElectronNightlyVersion =
    dependencies?.[PKG_NAME_ELECTRON.NIGHTLY] || devDependencies?.[PKG_NAME_ELECTRON.NIGHTLY];

  let electronVersion;

  if (
    pkgElectronVersion?.startsWith(PNPM_CATALOG_PREFIX) ||
    pkgElectronNightlyVersion?.startsWith(PNPM_CATALOG_PREFIX)
  ) {
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
