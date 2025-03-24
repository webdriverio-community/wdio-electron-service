import path from 'node:path';
import fs from 'node:fs/promises';
import { expect, it, describe } from 'vitest';
import type { NormalizedPackageJson } from 'read-package-up';

import { forgeBuildInfo, getConfig } from '../../src/config/forge';
import { APP_NAME_DETECTION_ERROR } from '../../src/constants';

function getFixturePackagePath(moduleType: string, fixtureName: string) {
  return path.resolve(process.cwd(), '..', '..', 'fixtures', moduleType, fixtureName, 'package.json');
}

async function getFixturePackageJson(jsonPath: string) {
  const packageJsonPath = jsonPath;
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  return {
    packageJson,
    path: packageJsonPath,
  };
}
describe('getConfig', () => {
  describe.each(['esm', 'cjs'])('%s', (type) => {
    it.each([
      ['Inline config', 'forge-dependency-inline-config'],
      ['JS config', 'forge-dependency-js-config'],
      ['Linked-JS config', 'forge-dependency-linked-js-config'],
    ])('%s', async (_title, scenario) => {
      const fixturePkg = getFixturePackagePath(type, scenario);
      const pkg = await getFixturePackageJson(fixturePkg);
      const config = await getConfig(pkg!);
      expect(config).toStrictEqual({
        appName: scenario,
        config: {
          packagerConfig: {
            name: scenario,
          },
        },
        isBuilder: false,
        isForge: true,
      });
    });

    it('should return undefined if no config is detected', async () => {
      const fixturePkg = getFixturePackagePath(type, 'forge-dependency-no-config');
      const pkg = await getFixturePackageJson(fixturePkg);
      const config = await getConfig(pkg);
      expect(config).toBeUndefined();
    });
  });
});

describe('forgeBuildInfo', () => {
  it('should return the expected config when productName is set in the package.json', async () => {
    const forgeConfig = {
      packagerConfig: {
        name: 'forge-product-config',
      },
    };
    expect(
      forgeBuildInfo(forgeConfig, {
        path: '/path/to/package.json',
        packageJson: {
          productName: 'forge-product',
        } as unknown as NormalizedPackageJson,
      }),
    ).toStrictEqual({
      appName: 'forge-product',
      config: { packagerConfig: { name: 'forge-product-config' } },
      isBuilder: false,
      isForge: true,
    });
  });

  it('should return the expected config when name of the packagerConfig is set in the forgeConfig', async () => {
    const forgeConfig = {
      packagerConfig: {
        name: 'forge-product-config',
      },
    };
    expect(
      forgeBuildInfo(forgeConfig, {
        path: '/path/to/package.json',
        packageJson: {
          name: 'forge-product-name',
        } as unknown as NormalizedPackageJson,
      }),
    ).toStrictEqual({
      appName: 'forge-product-config',
      config: { packagerConfig: { name: 'forge-product-config' } },
      isBuilder: false,
      isForge: true,
    });
  });

  it('should return the expected config when name is set in the package.json', async () => {
    const forgeConfig = {
      packagerConfig: {},
    };
    expect(
      forgeBuildInfo(forgeConfig, {
        path: '/path/to/package.json',
        packageJson: {
          name: 'forge-product-name',
        } as unknown as NormalizedPackageJson,
      }),
    ).toStrictEqual({
      appName: 'forge-product-name',
      config: { packagerConfig: {} },
      isBuilder: false,
      isForge: true,
    });
  });

  it('should throw the error when could not detect the appName', async () => {
    const forgeConfig = {
      packagerConfig: {},
    };
    expect(() =>
      forgeBuildInfo(forgeConfig, {
        path: '/path/to/package.json',
        packageJson: {
          version: '1.0.0',
        } as unknown as NormalizedPackageJson,
      }),
    ).toThrow(APP_NAME_DETECTION_ERROR);
  });
});
