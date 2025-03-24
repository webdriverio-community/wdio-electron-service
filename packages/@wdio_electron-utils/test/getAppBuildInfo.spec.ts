import path from 'node:path';
import fs from 'node:fs/promises';
import { expect, it, vi, describe } from 'vitest';

import log from '../src/log';
import { getAppBuildInfo } from '../src/getAppBuildInfo';
import { getConfig as getBuilderConfig } from '../src/config/builder';
import { getConfig as getForgeConfig } from '../src/config/forge';

import {
  BUILD_TOOL_DETECTION_ERROR,
  BUILDER_CONFIG_NOT_FOUND_ERROR,
  FORGE_CONFIG_NOT_FOUND_ERROR,
  MULTIPLE_BUILD_TOOL_WARNING,
} from '../src/constants';

function getFixturePackagePath(moduleType: string, fixtureName: string) {
  return path.resolve(process.cwd(), '..', '..', 'fixtures', moduleType, fixtureName, 'package.json');
}

vi.mock('../src/log', () => {
  return {
    default: {
      info: vi.fn(),
      warn: vi.fn(),
    },
  };
});

vi.mock('../src/config/builder', () => {
  return {
    getConfig: vi.fn(),
  };
});

vi.mock('../src/config/forge', () => {
  return {
    getConfig: vi.fn(),
  };
});

const builderConfig = {
  appName: 'builder-dependency-cjs-config',
  config: {
    productName: 'builder-dependency-cjs-config',
  },
  isBuilder: true,
  isForge: false,
} as const;

const forgeConfig = {
  appName: 'forge-dependency-inline-config',
  config: {
    packagerConfig: {
      name: 'forge-dependency-inline-config',
    },
  },
  isBuilder: false,
  isForge: true,
} as const;

describe('getAppBuildInfo()', () => {
  describe.each(['esm', 'cjs'])('%s', (type) => {
    it('should throw an error when builder is detected but has no config', async () => {
      const packageJsonPath = getFixturePackagePath(type, 'builder-dependency-cjs-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      vi.mocked(getBuilderConfig).mockResolvedValueOnce(undefined);

      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: path.dirname(packageJsonPath),
        }),
      ).rejects.toThrowError(BUILDER_CONFIG_NOT_FOUND_ERROR);
    });

    it('should throw an error when forge is detected but has no config', async () => {
      const packageJsonPath = getFixturePackagePath(type, 'forge-dependency-js-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      vi.mocked(getBuilderConfig).mockResolvedValueOnce(undefined);

      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: path.dirname(packageJsonPath),
        }),
      ).rejects.toThrowError(FORGE_CONFIG_NOT_FOUND_ERROR);
    });

    it('should return builder config', async () => {
      const packageJsonPath = getFixturePackagePath(type, 'builder-dependency-cjs-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      vi.mocked(getBuilderConfig).mockResolvedValueOnce(builderConfig);

      const result = await getAppBuildInfo({
        packageJson,
        path: path.dirname(packageJsonPath),
      });

      expect(result).toStrictEqual(builderConfig);
    });

    it('should return forge config', async () => {
      const packageJsonPath = getFixturePackagePath(type, 'forge-dependency-inline-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      vi.mocked(getForgeConfig).mockResolvedValueOnce(forgeConfig);
      const result = await getAppBuildInfo({
        packageJson,
        path: path.dirname(packageJsonPath),
      });

      expect(result).toStrictEqual(forgeConfig);
    });

    it('should return forge config when multiple builder tool was detected', async () => {
      const packageJsonPath = getFixturePackagePath(type, 'multiple-build-tools-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      vi.mocked(getForgeConfig).mockResolvedValueOnce(forgeConfig);
      vi.mocked(getBuilderConfig).mockResolvedValueOnce(builderConfig);
      const result = await getAppBuildInfo({
        packageJson,
        path: path.dirname(packageJsonPath),
      });

      expect(result).toStrictEqual(forgeConfig);
      expect(log.warn).toHaveBeenCalledTimes(2);
      expect(log.warn).toHaveBeenNthCalledWith(1, MULTIPLE_BUILD_TOOL_WARNING.DESCRIPTION);
      expect(log.warn).toHaveBeenNthCalledWith(2, MULTIPLE_BUILD_TOOL_WARNING.SUGGESTION);
    });

    it('should throw an error when no build tools are found', async () => {
      const packageJsonPath = getFixturePackagePath(type, 'no-build-tool');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: path.dirname(packageJsonPath),
        }),
      ).rejects.toThrowError(BUILD_TOOL_DETECTION_ERROR);
    });
  });
});
