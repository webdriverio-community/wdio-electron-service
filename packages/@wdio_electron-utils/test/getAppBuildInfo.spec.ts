import path from 'node:path';
import fs from 'node:fs/promises';
import { expect, it, vi, describe, beforeEach } from 'vitest';

import { getAppBuildInfo } from '../src/getAppBuildInfo';

import type { NormalizedPackageJson } from 'read-package-up';

function getFixturePackagePath(moduleType: string, fixtureName: string) {
  return path.resolve(process.cwd(), '..', '..', 'fixtures', moduleType, fixtureName, 'package.json');
}

const accessedConfigFilenames = new Set<string>();

// Create a map to hold custom mocks for specific file paths
const readFileMocks = new Map();
const accessMocks = new Map();
// Special tracking set for the builder config variants test
beforeEach(() => {
  vi.resetAllMocks();
  readFileMocks.clear();
  accessMocks.clear();
  accessedConfigFilenames.clear();

  // Mock fs.readFile to return appropriate JSON for different fixture types
  vi.spyOn(fs, 'readFile').mockImplementation((filePath, _options) => {
    // Handle package.json files with different fixture types
    const filePathStr = String(filePath);

    // Check if it's a fixture path
    if (filePathStr.includes('/fixtures/') || filePathStr.includes('\\fixtures\\')) {
      // Extract the fixture type from the path
      const match = filePathStr.match(/[/\\]fixtures[/\\]([^/\\]+)[/\\]([^/\\]+)[/\\]package\.json$/);
      if (match) {
        const moduleType = match[1]; // cjs or esm
        const fixtureName = match[2]; // name of the fixture

        if (fixtureName.startsWith('forge-dependency')) {
          // For no-config fixtures, don't include the config
          if (fixtureName.includes('no-config')) {
            return Promise.resolve(
              JSON.stringify({
                name: fixtureName,
                devDependencies: {
                  '@electron-forge/cli': '6.0.0',
                },
              }),
            );
          }

          // For linked-js-config-broken, set a custom config path
          if (fixtureName.includes('linked-js-config-broken')) {
            return Promise.resolve(
              JSON.stringify({
                name: fixtureName,
                config: {
                  forge: './custom-config.js',
                },
                devDependencies: {
                  '@electron-forge/cli': '6.0.0',
                },
              }),
            );
          }

          // For other forge fixtures
          return Promise.resolve(
            JSON.stringify({
              name: fixtureName,
              config: {
                forge: {
                  packagerConfig: {
                    name: fixtureName,
                  },
                },
              },
              devDependencies: {
                '@electron-forge/cli': '6.0.0',
              },
            }),
          );
        } else if (fixtureName.startsWith('builder-dependency')) {
          // For no-config fixtures, don't include build
          if (fixtureName.includes('no-config')) {
            return Promise.resolve(
              JSON.stringify({
                name: fixtureName,
                devDependencies: {
                  'electron-builder': '22.0.0',
                },
              }),
            );
          }

          return Promise.resolve(
            JSON.stringify({
              name: fixtureName,
              build: {
                productName: fixtureName,
              },
              devDependencies: {
                'electron-builder': '1.0.0',
              },
            }),
          );
        } else if (fixtureName.startsWith('multiple-build-tools')) {
          // For no-config, don't include build or forge config
          if (fixtureName.includes('no-config')) {
            return Promise.resolve(
              JSON.stringify({
                name: fixtureName,
                devDependencies: {
                  'electron-builder': '22.0.0',
                  '@electron-forge/cli': '6.0.0',
                },
              }),
            );
          }

          if (fixtureName.includes('wrong-config-1')) {
            return Promise.resolve(
              JSON.stringify({
                name: fixtureName,
                build: {
                  productName: fixtureName,
                },
                devDependencies: {
                  'electron-builder': '1.0.0',
                  '@electron-forge/cli': '1.0.0',
                },
              }),
            );
          } else if (fixtureName.includes('wrong-config-2')) {
            return Promise.resolve(
              JSON.stringify({
                name: fixtureName,
                config: {
                  forge: {
                    packagerConfig: {
                      name: fixtureName,
                    },
                  },
                },
                devDependencies: {
                  'electron-builder': '1.0.0',
                  '@electron-forge/cli': '1.0.0',
                },
              }),
            );
          } else {
            return Promise.resolve(
              JSON.stringify({
                name: fixtureName,
                config: {
                  forge: {
                    packagerConfig: {
                      name: fixtureName,
                    },
                  },
                },
                build: {
                  productName: fixtureName,
                },
                devDependencies: {
                  'electron-builder': '1.0.0',
                  '@electron-forge/cli': '1.0.0',
                },
              }),
            );
          }
        } else if (fixtureName === 'no-app-name-in-build-tool-config') {
          return Promise.resolve(
            JSON.stringify({
              name: `fixture-${moduleType}_${fixtureName}`,
              build: {
                appId: fixtureName,
              },
              devDependencies: {
                'electron-builder': '1.0.0',
              },
            }),
          );
        } else if (fixtureName === 'no-build-tool') {
          return Promise.resolve(
            JSON.stringify({
              name: fixtureName,
              devDependencies: {},
            }),
          );
        }
      }
    }

    // Default fallback for any other files
    if (filePathStr.endsWith('.json')) {
      return Promise.resolve('{}');
    }
    return Promise.resolve('');
  });

  // Mock fs.access to check against the accessMocks map
  vi.spyOn(fs, 'access').mockImplementation((path) => {
    const pathStr = String(path);

    // Track accessed config files for the variant test
    if (
      pathStr.includes('builder-dependency-no-config') &&
      (pathStr.includes('electron-builder.') || pathStr.includes('electron-builder/')) &&
      !pathStr.endsWith('package.json')
    ) {
      accessedConfigFilenames.add(pathStr);

      // Make sure the test case for trying all builder config variants fails properly
      throw new Error('ENOENT: no such file or directory');
    }

    // For config files, check if they exist
    if (
      pathStr.includes('forge.config.js') ||
      pathStr.includes('electron-builder.') ||
      pathStr.endsWith('.config.js') ||
      pathStr.endsWith('.config.ts') ||
      pathStr.endsWith('.config.mjs') ||
      pathStr.endsWith('.config.cjs') ||
      pathStr.endsWith('.config.json')
    ) {
      // Specially handle certain config files based on the fixture name
      if (pathStr.includes('/fixtures/') || pathStr.includes('\\fixtures\\')) {
        const match = pathStr.match(/[/\\]fixtures[/\\]([^/\\]+)[/\\]([^/\\]+)[/\\](.+)$/);
        if (match) {
          const fixtureName = match[2];
          const configFile = match[3];

          // For no-config fixtures, reject all config file access
          if (fixtureName.includes('no-config')) {
            throw new Error('ENOENT: no such file or directory');
          }

          // For linked-js-config-broken, reject the config file
          if (fixtureName.includes('linked-js-config-broken') && configFile.includes('custom-config.js')) {
            throw new Error('ENOENT: no such file or directory');
          }

          // For specific fixture types that should have config files
          if (fixtureName.startsWith('builder-dependency') && !fixtureName.includes('no-config')) {
            const configType = fixtureName.split('-').pop() || '';
            if (
              configFile.includes(configType) ||
              (configType === 'inline-config' && configFile.includes('electron-builder'))
            ) {
              return Promise.resolve();
            }
          } else if (fixtureName.startsWith('forge-dependency') && !fixtureName.includes('no-config')) {
            const configType = fixtureName.split('-').pop() || '';
            if (
              configFile.includes(configType) ||
              (configType === 'inline-config' && configFile.includes('forge.config'))
            ) {
              return Promise.resolve();
            }
          } else if (fixtureName.startsWith('multiple-build-tools')) {
            if (fixtureName.includes('wrong-config-1')) {
              // Only allow builder config for this test
              if (configFile.includes('electron-builder')) {
                return Promise.resolve();
              }
            } else if (fixtureName.includes('wrong-config-2')) {
              // Only allow forge config for this test
              if (configFile.includes('forge.config')) {
                return Promise.resolve();
              }
            } else {
              // Allow both configs
              if (configFile.includes('forge.config') || configFile.includes('electron-builder')) {
                return Promise.resolve();
              }
            }
          }

          // Explicitly reject for any other config files
          throw new Error('ENOENT: no such file or directory');
        }
      }
    }

    // Check against the accessMocks map for binary paths
    if (accessMocks.has(pathStr)) {
      return accessMocks.get(pathStr)?.() || Promise.reject(new Error('ENOENT'));
    }

    // Use normalized paths (both Windows and Unix style) as fallback
    const normalizedUnixPath = pathStr.replace(/\\/g, '/');
    const normalizedWinPath = pathStr.replace(/\//g, '\\');

    if (accessMocks.has(normalizedUnixPath)) {
      return accessMocks.get(normalizedUnixPath)?.() || Promise.reject(new Error('ENOENT'));
    }

    if (accessMocks.has(normalizedWinPath)) {
      return accessMocks.get(normalizedWinPath)?.() || Promise.reject(new Error('ENOENT'));
    }

    return Promise.reject(new Error('ENOENT'));
  });
});

describe('getAppBuildInfo()', () => {
  describe('ESM', () => {
    it('should throw an error when no build tools are found', async () => {
      const packageJsonPath = getFixturePackagePath('esm', 'no-build-tool');
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
      const packageJsonPath = getFixturePackagePath('esm', 'multiple-build-tools-no-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).rejects.toThrow(/Forge was detected but no configuration was found at '(.*)forge.config.js'./);
    });

    it('should throw an error when the Forge app name is unable to be determined', async () => {
      // Create a minimal package.json with Forge dependency but no app name
      const packageJson = {
        // name property intentionally omitted to test error case
        version: '1.0.0',
        readme: '',
        _id: 'no-name@1.0.0',
        config: {
          forge: {},
        },
        devDependencies: {
          '@electron-forge/cli': '6.0.0',
        },
      } as unknown as NormalizedPackageJson;

      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: '/path/to/package.json',
        }),
      ).rejects.toThrow(
        'No application name was detected, please set name / productName in your package.json or build tool configuration.',
      );
    });

    it('should throw an error when the builder app name is unable to be determined', async () => {
      // Create a minimal package.json with Builder dependency but no app name
      const packageJson = {
        // name property intentionally omitted to test error case
        version: '1.0.0',
        readme: '',
        _id: 'no-name@1.0.0',
        build: {},
        devDependencies: {
          'electron-builder': '22.0.0',
        },
      } as unknown as NormalizedPackageJson;

      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: '/path/to/package.json',
        }),
      ).rejects.toThrow(
        'No application name was detected, please set name / productName in your package.json or build tool configuration.',
      );
    });

    it('should throw an error when builder is detected but has no config', async () => {
      const packageJsonPath = getFixturePackagePath('esm', 'builder-dependency-no-config');
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

    it('should throw an error when Forge is detected but has no config', async () => {
      const packageJsonPath = getFixturePackagePath('esm', 'forge-dependency-no-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).rejects.toThrow(/Forge was detected but no configuration was found at '(.*)forge.config.js'./);
    });

    it('should throw an error when Forge is detected with a linked JS config but the config file cannot be read', async () => {
      const packageJsonPath = getFixturePackagePath('esm', 'forge-dependency-linked-js-config-broken');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(
        getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).rejects.toThrow(/Forge was detected but no configuration was found at '(.*)custom-config.js'./);
    });

    it('should return the expected config when configuration for builder is found alongside a Forge dependency', async () => {
      const packageJsonPath = getFixturePackagePath('esm', 'multiple-build-tools-wrong-config-1');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(
        await getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).toStrictEqual({
        appName: 'multiple-build-tools-wrong-config-1',
        config: { productName: 'multiple-build-tools-wrong-config-1' },
        isBuilder: true,
        isForge: false,
      });
    });

    it('should return the expected config when configuration for Forge is found alongside a builder dependency', async () => {
      const packageJsonPath = getFixturePackagePath('esm', 'multiple-build-tools-wrong-config-2');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(
        await getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).toStrictEqual({
        appName: 'multiple-build-tools-wrong-config-2',
        config: { packagerConfig: { name: 'multiple-build-tools-wrong-config-2' } },
        isBuilder: false,
        isForge: true,
      });
    });

    it('should return the expected config for a Forge dependency with JS config', async () => {
      const packageJsonPath = getFixturePackagePath('esm', 'forge-dependency-js-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(
        await getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).toStrictEqual({
        appName: 'forge-dependency-js-config',
        config: { packagerConfig: { name: 'forge-dependency-js-config' } },
        isBuilder: false,
        isForge: true,
      });
    });

    it('should return the expected config for a Forge dependency with linked JS config', async () => {
      const packageJsonPath = getFixturePackagePath('esm', 'forge-dependency-linked-js-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(
        await getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).toStrictEqual({
        appName: 'forge-dependency-linked-js-config',
        config: { packagerConfig: { name: 'forge-dependency-linked-js-config' } },
        isBuilder: false,
        isForge: true,
      });
    });

    it('should try to access all variants of builder config files', async () => {
      const packageJsonPath = getFixturePackagePath('esm', 'builder-dependency-no-config');
      const packageJson = {
        name: 'builder-dependency-no-config',
        version: '1.0.0',
        readme: '',
        _id: 'builder-dependency-no-config@1.0.0',
        devDependencies: {
          'electron-builder': '22.0.0',
        },
      } as NormalizedPackageJson;

      await expect(
        getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).rejects.toThrow('Electron-builder was detected but no configuration was found');

      // Check that we tried to access config files
      expect(accessedConfigFilenames.size).toBeGreaterThan(0);

      // Check that the tracked paths match our expected pattern
      const trackedPaths = Array.from(accessedConfigFilenames);
      trackedPaths.forEach((path) => {
        expect(path.includes('builder-dependency-no-config')).toBe(true);
        expect(path.includes('electron-builder')).toBe(true);
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
