import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';

import { getConfig } from '../../src/config/builder';
import { APP_NAME_DETECTION_ERROR } from '../../src/constants';

async function getFixturePackagePath(moduleType: string, fixtureName: string) {
  const packageJsonPath = path.resolve(process.cwd(), '..', '..', 'fixtures', moduleType, fixtureName, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  return {
    packageJson,
    path: packageJsonPath,
  };
}

const expectedCandidates = [
  'electron-builder.yml',
  'electron-builder.config.yml',
  'electron-builder.yaml',
  'electron-builder.config.yaml',
  'electron-builder.json',
  'electron-builder.config.json',
  'electron-builder.json5',
  'electron-builder.config.json5',
  'electron-builder.toml',
  'electron-builder.config.toml',
  'electron-builder.js',
  'electron-builder.config.js',
  'electron-builder.mjs',
  'electron-builder.config.mjs',
  'electron-builder.cjs',
  'electron-builder.config.cjs',
  'electron-builder.ts',
  'electron-builder.config.ts',
  'electron-builder.mts',
  'electron-builder.config.mts',
  'electron-builder.cts',
  'electron-builder.config.cts',
];

describe('getConfig', () => {
  describe.each(['esm', 'cjs'])('%s', (type) => {
    it.each([
      ['CJS config', 'builder-dependency-cjs-config'],
      ['CTS config', 'builder-dependency-cts-config'],
      ['JS config', 'builder-dependency-js-config'],
      ['JSON config', 'builder-dependency-json-config'],
      ['JSON5 config', 'builder-dependency-json5-config'],
      ['MJS config', 'builder-dependency-mjs-config'],
      ['MTS config', 'builder-dependency-mts-config'],
      ['TOML config', 'builder-dependency-toml-config'],
      ['TS-Fn config', 'builder-dependency-ts-fn-config'],
      ['TS-Obj config', 'builder-dependency-ts-obj-config'],
      ['YAML(.yaml) config', 'builder-dependency-yaml-config'],
      ['YAML(.yml) config', 'builder-dependency-yml-config'],
    ])('%s', async (_title, scenario) => {
      const pkg = await getFixturePackagePath(type, scenario);
      const config = await getConfig(pkg);
      expect(config).toStrictEqual({
        appName: scenario,
        config: {
          productName: scenario,
        },
        isBuilder: true,
        isForge: false,
      });
    });

    it('should return undefined if no config file is found', async () => {
      const spy = vi.spyOn(fs, 'access');
      const pkg = await getFixturePackagePath(type, 'builder-dependency-no-config');
      const config = await getConfig(pkg);
      const checkedFiles = spy.mock.calls.map(([file]) => path.basename(file.toString()));

      expect(config).toBeUndefined();
      expect(checkedFiles).toStrictEqual(expectedCandidates);
    });

    it('should return the expected config when productName is set in the package.json', async () => {
      const pkg = await getFixturePackagePath(type, 'builder-dependency-inline-config');
      const config = await getConfig(pkg);

      expect(config?.appName).toBe('builder-dependency-inline-config-product-name');
    });

    it('should return the expected config when name of the packagerConfig is set in the builderConfig', async () => {
      const pkg = await getFixturePackagePath(type, 'builder-dependency-inline-config');
      delete pkg.packageJson.productName;
      const config = await getConfig(pkg);

      expect(config?.appName).toBe('builder-dependency-inline-config');
    });

    it('should return the expected config when name is set in the package.json', async () => {
      const pkg = await getFixturePackagePath(type, 'builder-dependency-inline-config');
      delete pkg.packageJson.productName;
      delete pkg.packageJson.build.productName;
      const config = await getConfig(pkg);

      expect(config?.appName).toBe(`fixture-${type}_builder-dependency-inline-config`);
    });

    it('should throw the error when could not detect the appName', async () => {
      const pkg = await getFixturePackagePath(type, 'builder-dependency-inline-config');
      delete pkg.packageJson.productName;
      delete pkg.packageJson.build.productName;
      delete pkg.packageJson.name;

      await expect(() => getConfig(pkg)).rejects.toThrowError(APP_NAME_DETECTION_ERROR);
    });
  });
});
