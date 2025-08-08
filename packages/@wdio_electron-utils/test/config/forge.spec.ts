import { describe, expect, it, vi } from 'vitest';
import { getConfig } from '../../src/config/forge.js';
import { APP_NAME_DETECTION_ERROR } from '../../src/constants.js';
import { getFixturePackageJson } from '../testUtils.js';

vi.mock('../../src/log.js', () => import('../__mock__/log.js'));

describe('getConfig', () => {
  describe('config formats', () => {
    it.each([
      ['Inline config', 'forge-dependency-inline-config'],
      ['JS config', 'forge-dependency-js-config'],
      ['Linked-JS config', 'forge-dependency-linked-js-config'],
    ])('%s', async (_title, scenario) => {
      const pkg = await getFixturePackageJson('config-formats', scenario);
      const config = await getConfig(pkg);
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
      const pkg = await getFixturePackageJson('config-formats', 'forge-dependency-no-config');
      const config = await getConfig(pkg);
      expect(config).toBeUndefined();
    });

    it('should return the expected config when productName is set in the package.json', async () => {
      const pkg = await getFixturePackageJson('config-formats', 'forge-dependency-inline-config');
      pkg.packageJson.productName = 'forge-dependency-inline-config-product-name';
      const config = await getConfig(pkg);

      expect(config?.appName).toBe('forge-dependency-inline-config-product-name');
    });

    it('should return the expected config when name of the packagerConfig is set in the builderConfig', async () => {
      const pkg = await getFixturePackageJson('config-formats', 'forge-dependency-inline-config');
      const config = await getConfig(pkg);

      expect(config?.appName).toBe('forge-dependency-inline-config');
    });

    it('should return the expected config when name is set in the package.json', async () => {
      const pkg = await getFixturePackageJson('config-formats', 'forge-dependency-inline-config');
      delete pkg.packageJson.config.forge.packagerConfig.name;
      const config = await getConfig(pkg);

      expect(config?.appName).toBe('fixture-config-formats_forge-dependency-inline-config');
    });

    it('should throw the error when could not detect the appName', async () => {
      const pkg = await getFixturePackageJson('config-formats', 'forge-dependency-inline-config');
      delete pkg.packageJson.config.forge.packagerConfig.name;
      delete pkg.packageJson.name;

      await expect(() => getConfig(pkg)).rejects.toThrowError(APP_NAME_DETECTION_ERROR);
    });
  });
});
