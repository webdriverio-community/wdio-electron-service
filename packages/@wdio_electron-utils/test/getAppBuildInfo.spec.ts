import path from 'node:path';
import fs from 'node:fs/promises';
import { expect, it, vi, describe } from 'vitest';

import { getAppBuildInfo } from '../src/getAppBuildInfo';
import * as forge from '../src/config/forge';
import * as builder from '../src/config/builder';

import type { NormalizedPackageJson } from 'read-package-up';

function getFixturePackagePath(moduleType: string, fixtureName: string) {
  return path.resolve(process.cwd(), '..', '..', 'fixtures', moduleType, fixtureName, 'package.json');
}

describe('getAppBuildInfo()', () => {
  describe.each(['esm', 'cjs'])('%s', (type) => {
    it('should throw an error when no build tools are found', async () => {
      const packageJsonPath = getFixturePackagePath(type, 'no-build-tool');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).rejects.toThrow(
        'No build tool was detected, if the application is compiled at a different location, please specify the `appBinaryPath` option in your capabilities.',
      );
    });

    it('should throw an error when dependencies for multiple build tools are found without configuration', async () => {
      const packageJsonPath = getFixturePackagePath(type, 'multiple-build-tools-no-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).rejects.toThrow(/Forge was detected but no configuration was found at '(.*)forge.config.js'./);
    });

    it('should throw an error when forgeBuildInfo throws the error', async () => {
      // Create a minimal package.json with Forge dependency but no app name
      const packageJson = {
        config: {
          forge: {},
        },
        devDependencies: {
          '@electron-forge/cli': '6.0.0',
        },
      } as unknown as NormalizedPackageJson;
      vi.spyOn(forge, 'forgeBuildInfo').mockImplementationOnce(() => {
        throw new Error('Config read error');
      });

      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: '/path/to/package.json',
        }),
      ).rejects.toThrow('Config read error');
    });

    vi.mock('../src/config/builder', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/config/builder')>();
      return {
        ...actual,
        getBuilderConfigCandidates: vi.fn().mockReturnValue([]),
        getConfig: vi.fn(),
      };
    });

    it('should throw an error when the builder app name is unable to be determined', async () => {
      // Create a minimal package.json with Builder dependency but no app name
      const packageJson = {
        build: {},
        devDependencies: {
          'electron-builder': '22.0.0',
        },
      } as unknown as NormalizedPackageJson;
      vi.spyOn(builder, 'builderBuildInfo').mockImplementationOnce(() => {
        throw new Error('Config read error');
      });

      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: '/path/to/package.json',
        }),
      ).rejects.toThrow('Config read error');
    });

    it('should throw an error when builder is detected but has no config', async () => {
      vi.mocked(builder.getConfig).mockResolvedValueOnce(undefined);
      const packageJsonPath = getFixturePackagePath(type, 'builder-dependency-no-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(
        getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).rejects.toThrow(
        'Electron-builder was detected but no configuration was found, make sure your config file is named correctly, e.g. `electron-builder.config.json`.',
      );
    });

    it('ok builder', async () => {
      vi.mocked(builder.getConfig).mockResolvedValueOnce({
        result: {
          productName: 'builder-dependency-no-config',
        },
        configFile: '',
      });
      const packageJsonPath = getFixturePackagePath(type, 'builder-dependency-no-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      expect(
        await getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).toStrictEqual({
        appName: 'builder-dependency-no-config',
        config: {
          productName: 'builder-dependency-no-config',
        },
        isBuilder: true,
        isForge: false,
      });
    });

    it('ok forge', async () => {
      vi.mocked(builder.getConfig).mockResolvedValueOnce({
        result: {
          productName: 'builder-dependency-no-config',
        },
        configFile: '',
      });
      const packageJsonPath = getFixturePackagePath(type, 'forge-dependency-linked-js-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      expect(
        await getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).toStrictEqual({
        appName: 'forge-dependency-linked-js-config',
        config: {
          packagerConfig: { name: 'forge-dependency-linked-js-config' },
        },
        isBuilder: false,
        isForge: true,
      });
    });
  });
});

// Test for getAppBuildInfo that covers both Forge and Builder configs being present
describe('getAppBuildInfo with Multiple Build Tools', () => {
  it('should handle both Forge and Builder configs being present and prefer Forge', async () => {
    // Create a package.json with both forge and builder configs
    const pkgJson = {
      name: 'both-configs-app',
      version: '1.0.0',
      readme: '',
      _id: 'both-configs-app@1.0.0',
      build: {
        productName: 'Builder App',
      },
      config: {
        forge: {
          packagerConfig: {
            name: 'Forge App',
          },
        },
      },
      devDependencies: {
        'electron-builder': '22.0.0',
        '@electron-forge/cli': '6.0.0',
      },
    } as NormalizedPackageJson;

    const result = await getAppBuildInfo({
      packageJson: pkgJson,
      path: '/path/to/package.json',
    });

    // Should prefer Forge config
    expect(result.isForge).toBe(true);
    expect(result.isBuilder).toBe(false);
    expect(result.appName).toBe('Forge App');
  });
});
