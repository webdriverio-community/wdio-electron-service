import { describe, expect, it, vi } from 'vitest';
import { getAppBuildInfo } from '../src/appBuildInfo.js';
import { getConfig as getBuilderConfig } from '../src/config/builder.js';
import { getConfig as getForgeConfig } from '../src/config/forge.js';
import {
  BUILD_TOOL_DETECTION_ERROR,
  BUILDER_CONFIG_NOT_FOUND_ERROR,
  FORGE_CONFIG_NOT_FOUND_ERROR,
  MULTIPLE_BUILD_TOOL_WARNING,
} from '../src/constants.js';
import { getFixturePackageJson } from './testUtils.js';

vi.mock('../src/log.js', () => import('./__mock__/log.js'));

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
  describe('package scenarios', () => {
    it('should throw an error when builder is detected but has no config', async () => {
      const pkg = await getFixturePackageJson('config-formats', 'builder-dependency-cjs-config');
      vi.mocked(getBuilderConfig).mockResolvedValueOnce(undefined);

      await expect(() => getAppBuildInfo(pkg)).rejects.toThrowError(BUILDER_CONFIG_NOT_FOUND_ERROR);
    });

    it('should throw an error when forge is detected but has no config', async () => {
      const pkg = await getFixturePackageJson('config-formats', 'forge-dependency-js-config');
      vi.mocked(getBuilderConfig).mockResolvedValueOnce(undefined);

      await expect(() => getAppBuildInfo(pkg)).rejects.toThrowError(FORGE_CONFIG_NOT_FOUND_ERROR);
    });

    it('should return builder config', async () => {
      const pkg = await getFixturePackageJson('config-formats', 'builder-dependency-cjs-config');
      vi.mocked(getBuilderConfig).mockResolvedValueOnce(builderConfig);

      const result = await getAppBuildInfo(pkg);

      expect(result).toStrictEqual(builderConfig);
    });

    it('should return forge config', async () => {
      const pkg = await getFixturePackageJson('config-formats', 'forge-dependency-inline-config');
      vi.mocked(getForgeConfig).mockResolvedValueOnce(forgeConfig);
      const result = await getAppBuildInfo(pkg);

      expect(result).toStrictEqual(forgeConfig);
    });

    it('should return forge config when multiple builder tool was detected', async () => {
      const pkg = await getFixturePackageJson('package-scenarios', 'multiple-build-tools-config');
      vi.mocked(getForgeConfig).mockResolvedValueOnce(forgeConfig);
      vi.mocked(getBuilderConfig).mockResolvedValueOnce(builderConfig);
      const result = await getAppBuildInfo(pkg);

      expect(result).toStrictEqual(forgeConfig);
      const { createLogger } = await import('./__mock__/log.js');
      const mockLogger = createLogger();
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenNthCalledWith(1, MULTIPLE_BUILD_TOOL_WARNING.DESCRIPTION);
      expect(mockLogger.warn).toHaveBeenNthCalledWith(2, MULTIPLE_BUILD_TOOL_WARNING.SUGGESTION);
    });

    it('should throw an error when no build tools are found', async () => {
      const pkg = await getFixturePackageJson('package-scenarios', 'no-build-tool');

      await expect(() => getAppBuildInfo(pkg)).rejects.toThrowError(BUILD_TOOL_DETECTION_ERROR);
    });
  });
});
