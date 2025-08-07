import type { NormalizedPackageJson, NormalizedReadResult } from 'read-package-up';
import { describe, expect, it, vi } from 'vitest';
import { getElectronVersion } from '../src/electronVersion.js';
import { findPnpmCatalogVersion } from '../src/pnpm.js';

vi.mock('../src/pnpm', async () => {
  return {
    findPnpmCatalogVersion: vi.fn(),
  };
});

function createPackageJson(depName: string, dep: { [key: string]: string }) {
  const pkgJson = {
    name: 'my-app',
    version: '1.0.0',
  } as NormalizedPackageJson;
  pkgJson[depName] = dep;
  return pkgJson;
}
describe('getElectronVersion()', () => {
  it('should return the electron version from package.json dependencies', async () => {
    const pkg = {
      packageJson: createPackageJson('dependencies', { electron: '25.0.1' }),
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBe('25.0.1');
  });

  it('should return the electron version from package.json devDependencies', async () => {
    const pkg = {
      packageJson: createPackageJson('devDependencies', { electron: '25.0.1' }),
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBe('25.0.1');
  });

  it('should return the nightly electron version from package.json dependencies', async () => {
    const pkg = {
      packageJson: createPackageJson('dependencies', {
        'electron-nightly': '33.0.0-nightly.20240621',
      }),
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBe('33.0.0-nightly.20240621');
  });

  it('should prioritize electron over electron-nightly when both are set package.json dependencies', async () => {
    const pkg = {
      packageJson: createPackageJson('dependencies', {
        electron: '25.0.1',
        'electron-nightly': '33.0.0-nightly.20240621',
      }),
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBe('25.0.1');
  });

  it('should return the nightly electron version from package.json devDependencies', async () => {
    const pkg = {
      packageJson: createPackageJson('devDependencies', {
        'electron-nightly': '33.0.0-nightly.20240621',
      }),
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBe('33.0.0-nightly.20240621');
  });

  it('should return undefined when there is no electron dependency', async () => {
    const pkg = {
      packageJson: createPackageJson('dependencies', {}),
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBeUndefined();
  });

  it('should fetch the electron version from pnpm workspace', async () => {
    vi.mocked(findPnpmCatalogVersion).mockResolvedValueOnce('^29.4.1');

    const pkg = {
      packageJson: createPackageJson('devDependencies', { electron: 'catalog:' }),
      path: '/path/to/project/package.json',
    } as NormalizedReadResult;

    const version = await getElectronVersion(pkg);
    expect(version).toBe('29.4.1');
  });

  it('should fetch the electron-nightly version from pnpm workspace', async () => {
    // if the version is specified with caret(^), the return value would be "33.0.0"
    vi.mocked(findPnpmCatalogVersion).mockResolvedValueOnce('33.0.0-nightly.20240621');

    const pkg = {
      packageJson: createPackageJson('devDependencies', { 'electron-nightly': 'catalog:' }),
      path: '/path/to/project/package.json',
    } as NormalizedReadResult;

    const version = await getElectronVersion(pkg);
    expect(version).toBe('33.0.0-nightly.20240621');
  });

  it('should prioritize electron over electron-nightly when both are set pnpm catalog', async () => {
    vi.mocked(findPnpmCatalogVersion).mockResolvedValueOnce('29.4.1').mockResolvedValueOnce('33.0.0-nightly.20240621');

    const pkg = {
      packageJson: createPackageJson('dependencies', {
        electron: 'catalog:',
        'electron-nightly': 'catalog:',
      }),
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBe('29.4.1');
  });
});
