import { dirname } from 'node:path';
import findVersions from 'find-versions';
import type { NormalizedReadResult } from 'read-package-up';
import { PKG_NAME_ELECTRON, PNPM_CATALOG_PREFIX } from './constants.js';
import { findPnpmCatalogVersion } from './pnpm.js';

export async function getElectronVersion(pkg: NormalizedReadResult) {
  const projectDir = dirname(pkg.path);
  const { dependencies, devDependencies } = pkg.packageJson;

  const getElectronDependencies = async (pkgName: string) => {
    const deps = dependencies?.[pkgName] || devDependencies?.[pkgName];
    if (typeof deps === `undefined`) {
      return deps;
    }
    return deps.startsWith(PNPM_CATALOG_PREFIX) ? await findPnpmCatalogVersion(pkgName, deps, projectDir) : deps;
  };

  const pkgElectronVersion = await getElectronDependencies(PKG_NAME_ELECTRON.STABLE);
  const pkgElectronNightlyVersion = await getElectronDependencies(PKG_NAME_ELECTRON.NIGHTLY);

  const electronVersion = pkgElectronVersion || pkgElectronNightlyVersion;

  return electronVersion ? findVersions(electronVersion, { loose: true })[0] : undefined;
}
