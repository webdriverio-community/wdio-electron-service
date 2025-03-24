import { describe, expect, it } from 'vitest';
import type { NormalizedPackageJson } from 'read-package-up';

import { builderBuildInfo, getBuilderConfigCandidates, getConfig } from '../../src/config/builder';
import path from 'node:path';
import { APP_NAME_DETECTION_ERROR } from '../../src/constants';

function getFixturePackagePath(moduleType: string, fixtureName: string) {
  return path.resolve(process.cwd(), '..', '..', 'fixtures', moduleType, fixtureName, 'package.json');
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
describe('getBuilderConfigCandidates', () => {
  it('should generate file names of the builder configuration file', () => {
    const candidates = getBuilderConfigCandidates();

    expect(candidates).toStrictEqual(expectedCandidates);
  });
});

type ReadResult = { result: { productName: string } };
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
      const fixturePkg = getFixturePackagePath(type, scenario);
      const config = await getConfig(expectedCandidates, path.dirname(fixturePkg));
      expect((config as ReadResult)['result']['productName']).toBe(scenario);
    });

    it('should return undefined if no config file is found', async () => {
      const fixturePkg = getFixturePackagePath(type, 'builder-dependency-inline-config');
      const config = await getConfig(expectedCandidates, path.dirname(fixturePkg));
      expect(config).toBeUndefined();
    });
  });
});

describe('forgeBuildInfo', () => {
  it('should return the expected config when productName is set in the package.json', async () => {
    const builderConfig = {
      productName: 'builder-product',
    };
    expect(
      builderBuildInfo(builderConfig, {
        path: '/path/to/package.json',
        packageJson: {
          productName: 'builder-product-name',
        } as unknown as NormalizedPackageJson,
      }),
    ).toStrictEqual({
      appName: 'builder-product-name',
      config: { productName: 'builder-product' },
      isBuilder: true,
      isForge: false,
    });
  });

  it('should return the expected config when name of the packagerConfig is set in the forgeConfig', async () => {
    const builderConfig = {
      productName: 'builder-product',
    };
    expect(
      builderBuildInfo(builderConfig, {
        path: '/path/to/package.json',
        packageJson: {
          name: 'builder-product-name',
        } as unknown as NormalizedPackageJson,
      }),
    ).toStrictEqual({
      appName: 'builder-product',
      config: { productName: 'builder-product' },
      isBuilder: true,
      isForge: false,
    });
  });

  it('should return the expected config when name is set in the package.json', async () => {
    const builderConfig = {};
    expect(
      builderBuildInfo(builderConfig, {
        path: '/path/to/package.json',
        packageJson: {
          name: 'builder-product-name',
        } as unknown as NormalizedPackageJson,
      }),
    ).toStrictEqual({
      appName: 'builder-product-name',
      config: {},
      isBuilder: true,
      isForge: false,
    });
  });

  it('should throw the error when could not detect the appName', async () => {
    const builderConfig = {};
    expect(() =>
      builderBuildInfo(builderConfig, {
        path: '/path/to/package.json',
        packageJson: {
          version: '1.0.0',
        } as unknown as NormalizedPackageJson,
      }),
    ).toThrow(APP_NAME_DETECTION_ERROR);
  });
});
