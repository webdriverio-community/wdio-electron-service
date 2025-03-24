import { expect, it, describe } from 'vitest';
import type { NormalizedPackageJson } from 'read-package-up';

import { forgeBuildInfo } from '../../src/config/forge';
import { APP_NAME_DETECTION_ERROR } from '../../src/constants';

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
