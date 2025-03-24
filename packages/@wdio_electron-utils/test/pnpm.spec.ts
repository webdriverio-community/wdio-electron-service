import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, it, vi, describe } from 'vitest';
import { findPnpmCatalogVersion } from '../src/pnpm';

function getPnpmFixtureDirPath(subPath?: string[]) {
  const fixtureDir = path.resolve(process.cwd(), '..', '..', 'fixtures', 'pnpm');
  if (subPath) {
    return path.join(fixtureDir, ...subPath);
  }
  return fixtureDir;
}

// Additional tests for findPnpmCatalogVersion to cover edge cases
describe('PNPM Catalog Versions Edge Cases', () => {
  it('should handle default catalog names', async () => {
    const version = await findPnpmCatalogVersion('catalog:', undefined, getPnpmFixtureDirPath());
    expect(version).toBe('^29.4.1');
  });

  it('should handle named catalog names', async () => {
    const version = await findPnpmCatalogVersion('catalog:sample1', undefined, getPnpmFixtureDirPath());
    expect(version).toBe('^35.0.3');
  });

  it('should handle default catalog names of nightly-version', async () => {
    const version = await findPnpmCatalogVersion(undefined, 'catalog:', getPnpmFixtureDirPath());
    expect(version).toBe('33.0.0-nightly.20240621');
  });

  it('should handle named catalog names of nightly-version', async () => {
    const version = await findPnpmCatalogVersion(undefined, 'catalog:sample2', getPnpmFixtureDirPath());
    expect(version).toBe('^37.0.0-nightly.20250320');
  });

  it('should prioritize electron over electron-nightly when both are using catalogs', async () => {
    const version = await findPnpmCatalogVersion('catalog:', 'catalog:', getPnpmFixtureDirPath());
    expect(version).toBe('^29.4.1');
  });

  it("should fallback to electron-nightly when electron catalog doesn't exist", async () => {
    const version = await findPnpmCatalogVersion('catalog:sample2', 'catalog:sample2', getPnpmFixtureDirPath());
    expect(version).toBe('^37.0.0-nightly.20250320');
  });

  it('should handle a mix of named and default catalogs', async () => {
    const version = await findPnpmCatalogVersion('catalog:sample1', 'catalog:sample2', getPnpmFixtureDirPath());
    expect(version).toBe('^35.0.3');
  });

  it('should handle missing projectDir', async () => {
    const version = await findPnpmCatalogVersion('catalog:name', undefined, undefined);
    expect(version).toBeUndefined();
  });

  it('should return undefined when pnpm-workspace.yaml was not found', async () => {
    const version = await findPnpmCatalogVersion('catalog:name', undefined, path.parse(getPnpmFixtureDirPath()).root);
    expect(version).toBeUndefined();
  });

  it('should handle YAML parse errors', async () => {
    const version = await findPnpmCatalogVersion(
      'catalog:name',
      undefined,
      getPnpmFixtureDirPath(['packages', 'app2']),
    );
    expect(version).toBeUndefined();
  });

  it('should handle other errors in findPnpmCatalogVersion', async () => {
    // Mock a function that throws an error when called
    vi.spyOn(fs, 'readFile').mockImplementation(() => {
      throw new Error('Some unexpected error');
    });

    // This should hit line 341 - the catch block in findPnpmCatalogVersion
    const result = await findPnpmCatalogVersion('default', '/non-existent-dir');
    expect(result).toBeUndefined();
  });

  it('should traverse up directory tree to find pnpm-workspace.yaml', async () => {
    const readFileSpy = vi.spyOn(fs, 'readFile');

    const version = await findPnpmCatalogVersion(
      'catalog:sample1',
      undefined,
      getPnpmFixtureDirPath(['packages', 'app1']),
    );

    // Should find the version in parent directory
    expect(version).toBe('^35.0.3');

    // Verify that readFile was called multiple times as it traversed up
    expect(readFileSpy).toHaveBeenCalledTimes(3);

    // Normalize paths to forward slashes for comparison
    expect(readFileSpy).toHaveBeenNthCalledWith(
      1,
      path.join(getPnpmFixtureDirPath(['packages', 'app1']), 'pnpm-workspace.yaml'),
      'utf8',
    );
    expect(readFileSpy).toHaveBeenNthCalledWith(
      2,
      path.join(getPnpmFixtureDirPath(['packages']), 'pnpm-workspace.yaml'),
      'utf8',
    );
    expect(readFileSpy).toHaveBeenNthCalledWith(3, path.join(getPnpmFixtureDirPath([]), 'pnpm-workspace.yaml'), 'utf8');
  });
});
