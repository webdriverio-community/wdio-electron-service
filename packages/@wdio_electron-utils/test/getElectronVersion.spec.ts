import { expect, it, vi, describe } from 'vitest';

import { getElectronVersion } from '../src/getElectronVersion';
import { findPnpmCatalogVersion } from '../src/pnpm';

import type { NormalizedPackageJson, NormalizedReadResult } from 'read-package-up';

vi.mock('../src/pnpm', async () => {
  return {
    findPnpmCatalogVersion: vi.fn(),
  };
});
describe('getElectronVersion()', () => {
  it('should return the electron version from package.json dependencies', async () => {
    const pkg = {
      packageJson: {
        name: 'my-app',
        version: '1.0.0',
        dependencies: {
          electron: '25.0.1',
        },
      } as Omit<NormalizedPackageJson, 'readme' | '_id'>,
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBe('25.0.1');
  });

  it('should return the electron version from package.json devDependencies', async () => {
    const pkg = {
      packageJson: {
        name: 'my-app',
        version: '1.0.0',
        devDependencies: {
          electron: '25.0.1',
        },
      } as Omit<NormalizedPackageJson, 'readme' | '_id'>,
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBe('25.0.1');
  });

  it('should return the nightly electron version from package.json dependencies', async () => {
    const pkg = {
      packageJson: {
        name: 'my-app',
        version: '1.0.0',
        dependencies: {
          'electron-nightly': '33.0.0-nightly.20240621',
        },
      } as Omit<NormalizedPackageJson, 'readme' | '_id'>,
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBe('33.0.0-nightly.20240621');
  });

  it('should return the nightly electron version from package.json devDependencies', async () => {
    const pkg = {
      packageJson: {
        name: 'my-app',
        version: '1.0.0',
        devDependencies: {
          'electron-nightly': '33.0.0-nightly.20240621',
        },
      } as Omit<NormalizedPackageJson, 'readme' | '_id'>,
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBe('33.0.0-nightly.20240621');
  });

  it('should return undefined when there is no electron dependency', async () => {
    const pkg = {
      packageJson: {
        name: 'my-app',
        version: '1.0.0',
        dependencies: {},
      } as Omit<NormalizedPackageJson, 'readme' | '_id'>,
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBeUndefined();
  });

  it('should fetch the electron version from pnpm workspace', async () => {
    vi.mocked(findPnpmCatalogVersion).mockResolvedValueOnce('^29.4.1');

    const pkgPath = '/path/to/project/package.json';

    const pkg = {
      packageJson: {
        name: 'my-app',
        version: '1.0.0',
        devDependencies: {
          electron: 'catalog:',
        },
      } as Omit<NormalizedPackageJson, 'readme' | '_id'>,
      path: pkgPath,
    } as NormalizedReadResult;

    const version = await getElectronVersion(pkg);
    expect(version).toBe('29.4.1');
  });

  it('should fetch the electron-nightly version from pnpm workspace', async () => {
    // if the version is specified with caret(^), the return value would be "33.0.0"
    vi.mocked(findPnpmCatalogVersion).mockResolvedValueOnce('33.0.0-nightly.20240621');

    const pkgPath = '/path/to/project/package.json';

    const pkg = {
      packageJson: {
        name: 'my-app',
        version: '1.0.0',
        devDependencies: {
          'electron-nightly': 'catalog:',
        },
      } as Omit<NormalizedPackageJson, 'readme' | '_id'>,
      path: pkgPath,
    } as NormalizedReadResult;

    const version = await getElectronVersion(pkg);
    expect(version).toBe('33.0.0-nightly.20240621');
  });
});
