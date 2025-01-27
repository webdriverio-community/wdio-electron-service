import fs from 'node:fs/promises';
import path from 'node:path';

import { assert, describe, it, expect, vi, Mock } from 'vitest';

import { getBinaryPath, getAppBuildInfo, getElectronVersion } from '../src/index.js';
import { NormalizedPackageJson, NormalizedReadResult } from 'read-package-up';

function getFixturePackagePath(moduleType: string, fixtureName: string) {
  return path.join(process.cwd(), '..', '..', 'fixtures', moduleType, fixtureName, 'package.json');
}

vi.mock('node:fs/promises', async (importOriginal) => {
  const originalFs = await importOriginal<typeof import('node:fs/promises')>();

  return {
    default: {
      ...originalFs,
      access: vi.fn(),
    },
  };
});

describe('getBinaryPath', () => {
  const pkgJSONPath = '/foo/bar/package.json';
  const winProcess = { platform: 'win32' } as NodeJS.Process;
  const macProcess = { platform: 'darwin' } as NodeJS.Process;
  const linuxProcess = { platform: 'linux' } as NodeJS.Process;
  const unsupportedPlatformProcess = { platform: 'aix' } as NodeJS.Process;

  function mockBinaryPath(binaryPath: string) {
    (fs.access as Mock).mockImplementation((path: string) => {
      if (path === binaryPath) {
        return Promise.resolve();
      } else {
        return Promise.reject(new Error(`ENOENT: no such file or directory, access '${path}' !== '${binaryPath}'`));
      }
    });
  }

  it('should throw an error when provided with an unsupported platform', async () =>
    expect(() =>
      getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { packagerConfig: { name: 'my-app' } },
          isForge: true,
          isBuilder: false,
        },
        '29.3.1',
        unsupportedPlatformProcess,
      ),
    ).rejects.toThrow('Unsupported platform: aix'));

  it('should throw an error when no binary is found for a Forge setup', async () => {
    const binaryPaths = [
      path.join('/foo', 'bar', 'out', 'my-app-win32-ia32', 'my-app.exe'),
      path.join('/foo', 'bar', 'out', 'my-app-win32-x64', 'my-app.exe'),
      path.join('/foo', 'bar', 'out', 'my-app-win32-arm64', 'my-app.exe'),
    ];
    (fs.access as Mock).mockImplementation(() => Promise.reject(new Error('No such file or directory')));
    await expect(
      getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { packagerConfig: { name: 'my-app' } },
          isForge: true,
          isBuilder: false,
        },
        '29.3.1',
        winProcess,
      ),
    ).rejects.toThrow(`No executable binary found, checked: \n${binaryPaths.join(', \n')}`);
  });

  it('should throw an error when no binary is found for a builder setup on MacOS', async () => {
    const binaryPaths = [
      path.join('/foo', 'bar', 'dist', 'mac-arm64', 'my-app.app', 'Contents', 'MacOS', 'my-app'),
      path.join('/foo', 'bar', 'dist', 'mac-armv7l', 'my-app.app', 'Contents', 'MacOS', 'my-app'),
      path.join('/foo', 'bar', 'dist', 'mac-ia32', 'my-app.app', 'Contents', 'MacOS', 'my-app'),
      path.join('/foo', 'bar', 'dist', 'mac-universal', 'my-app.app', 'Contents', 'MacOS', 'my-app'),
      path.join('/foo', 'bar', 'dist', 'mac', 'my-app.app', 'Contents', 'MacOS', 'my-app'),
    ];
    (fs.access as Mock).mockImplementation(() => Promise.reject(new Error('No such file or directory')));
    await expect(
      getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { productName: 'my-app' },
          isForge: false,
          isBuilder: true,
        },
        '29.3.1',
        macProcess,
      ),
    ).rejects.toThrow(`No executable binary found, checked: \n${binaryPaths.join(', \n')}`);
  });

  it('should throw an error when no binary is found for a Builder setup', async () => {
    const binaryPath = path.join('/foo', 'bar', 'dist', 'win-unpacked', 'my-app.exe');
    (fs.access as Mock).mockImplementation(() => Promise.reject(new Error('No such file or directory')));
    await expect(
      getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { productName: 'my-app' },
          isForge: false,
          isBuilder: true,
        },
        '29.3.1',
        winProcess,
      ),
    ).rejects.toThrow(`No executable binary found, checked: \n${binaryPath}`);
  });

  it('should return the expected app path for a Forge setup with multiple executable binaries', async () => {
    const binaryPath = path.join('/foo', 'bar', 'out', 'my-app-win32-ia32', 'my-app.exe');
    (fs.access as Mock).mockImplementation(() => Promise.resolve());
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { packagerConfig: { name: 'my-app' } },
          isForge: true,
          isBuilder: false,
        },
        '29.3.1',
        winProcess,
      ),
    ).toBe(binaryPath);
  });

  it('should return the expected app path for a builder setup with multiple executable binaries', async () => {
    const binaryPath = path.join('/foo', 'bar', 'dist', 'mac-arm64', 'my-app.app', 'Contents', 'MacOS', 'my-app');
    (fs.access as Mock).mockImplementation(() => Promise.resolve());
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { productName: 'my-app' },
          isForge: false,
          isBuilder: true,
        },
        '29.3.1',
        macProcess,
      ),
    ).toBe(binaryPath);
  });

  it('should return the expected app path for a Forge setup with custom output directory', async () => {
    const binaryPath = path.join('/foo', 'bar', 'custom-outdir', 'my-app-win32-x64', 'my-app.exe');
    mockBinaryPath(binaryPath);
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { packagerConfig: { name: 'my-app' }, outDir: 'custom-outdir' },
          isForge: true,
          isBuilder: false,
        },
        '29.3.1',
        winProcess,
      ),
    ).toBe(binaryPath);
  });

  it('should return the expected app path for a Forge setup on Windows', async () => {
    const binaryPath = path.join('/foo', 'bar', 'out', 'my-app-win32-x64', 'my-app.exe');
    mockBinaryPath(binaryPath);
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { packagerConfig: { name: 'my-app' } },
          isForge: true,
          isBuilder: false,
        },
        '29.3.1',
        winProcess,
      ),
    ).toBe(binaryPath);
  });

  it('should return the expected app path for a Forge setup on Arm Mac', async () => {
    const binaryPath = path.join(
      '/foo',
      'bar',
      'out',
      'my-app-darwin-arm64',
      'my-app.app',
      'Contents',
      'MacOS',
      'my-app',
    );
    mockBinaryPath(binaryPath);
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { packagerConfig: { name: 'my-app' } },
          isForge: true,
          isBuilder: false,
        },
        '29.3.1',
        macProcess,
      ),
    ).toBe(binaryPath);
  });

  it('should return the expected app path for a Forge setup on Intel Mac', async () => {
    const binaryPath = path.join(
      '/foo',
      'bar',
      'out',
      'my-app-darwin-x64',
      'my-app.app',
      'Contents',
      'MacOS',
      'my-app',
    );
    mockBinaryPath(binaryPath);
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { packagerConfig: { name: 'my-app' } },
          isForge: true,
          isBuilder: false,
        },
        '29.3.1',
        macProcess,
      ),
    ).toBe(binaryPath);
  });

  it('should return the expected app path for a Forge setup on Linux', async () => {
    const binaryPath = path.join('/foo', 'bar', 'out', 'my-app-linux-x64', 'my-app');
    mockBinaryPath(binaryPath);
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { packagerConfig: { name: 'my-app' } },
          isForge: true,
          isBuilder: false,
        },
        '29.3.1',
        linuxProcess,
      ),
    ).toBe(binaryPath);
  });

  it('should return the expected app path for a builder setup with custom output directory', async () => {
    const binaryPath = path.join('/foo', 'bar', 'custom-outdir', 'win-unpacked', 'my-app.exe');
    mockBinaryPath(binaryPath);
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { productName: 'my-app', directories: { output: 'custom-outdir' } },
          isForge: false,
          isBuilder: true,
        },
        '29.3.1',
        winProcess,
      ),
    ).toBe(binaryPath);
  });

  it('should return the expected app path for a builder setup on Windows', async () => {
    const binaryPath = path.join('/foo', 'bar', 'dist', 'win-unpacked', 'my-app.exe');
    mockBinaryPath(binaryPath);
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { productName: 'my-app' },
          isForge: false,
          isBuilder: true,
        },
        '29.3.1',
        winProcess,
      ),
    ).toBe(binaryPath);
  });

  it('should return the expected app path for a builder setup on Arm Mac', async () => {
    const binaryPath = path.join('/foo', 'bar', 'dist', 'mac-arm64', 'my-app.app', 'Contents', 'MacOS', 'my-app');
    mockBinaryPath(binaryPath);
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { productName: 'my-app' },
          isForge: false,
          isBuilder: true,
        },
        '29.3.1',
        macProcess,
      ),
    ).toBe(binaryPath);
  });

  it('should return the expected app path for a builder setup on Intel Mac', async () => {
    const binaryPath = path.join('/foo', 'bar', 'dist', 'mac', 'my-app.app', 'Contents', 'MacOS', 'my-app');
    mockBinaryPath(binaryPath);
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { productName: 'my-app' },
          isForge: false,
          isBuilder: true,
        },
        '29.3.1',
        macProcess,
      ),
    ).toBe(binaryPath);
  });

  it('should return the expected app path for a builder setup on Mac (universal arch)', async () => {
    const binaryPath = path.join('/foo', 'bar', 'dist', 'mac-universal', 'my-app.app', 'Contents', 'MacOS', 'my-app');
    mockBinaryPath(binaryPath);
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { productName: 'my-app' },
          isForge: false,
          isBuilder: true,
        },
        '29.3.1',
        macProcess,
      ),
    ).toBe(binaryPath);
  });

  it('should return the expected app path for a builder setup on Linux', async () => {
    const binaryPath = path.join('/foo', 'bar', 'dist', 'linux-unpacked', 'my-app');
    mockBinaryPath(binaryPath);
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { productName: 'my-app' },
          isForge: false,
          isBuilder: true,
        },
        '29.3.1',
        linuxProcess,
      ),
    ).toBe(binaryPath);
  });
});

describe('getAppBuildInfo', () => {
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
      const packageJsonPath = getFixturePackagePath('esm', 'forge-dependency-inline-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      delete packageJson.name;
      delete packageJson.config.forge.packagerConfig;
      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).rejects.toThrow(
        'No application name was detected, please set name / productName in your package.json or build tool configuration.',
      );
    });

    it('should throw an error when the builder app name is unable to be determined', async () => {
      const packageJsonPath = getFixturePackagePath('esm', 'builder-dependency-inline-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      delete packageJson.name;
      delete packageJson.build.productName;
      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
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
      await expect(
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
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      const spy = vi.spyOn(fs, 'access');
      try {
        await getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        });
      } catch (_e) {
        // An error will always occur because the configuration file does not exist.
        // Ignore errors to test to ensure all expected filename patterns are covered
      }
      const accessedFilenames = spy.mock.calls.map((call) => {
        if (typeof call[0] === 'string') {
          return path.basename(call[0]);
        }
        assert.fail(`fs.access called with a non-string value: ${call[0]}`);
      });
      const expected = [
        'electron-builder.json',
        'electron-builder.json5',
        'electron-builder.yml',
        'electron-builder.yaml',
        'electron-builder.toml',
        'electron-builder.js',
        'electron-builder.ts',
        'electron-builder.mjs',
        'electron-builder.cjs',
        'electron-builder.mts',
        'electron-builder.cts',
        'electron-builder.config.json',
        'electron-builder.config.json5',
        'electron-builder.config.yml',
        'electron-builder.config.yaml',
        'electron-builder.config.toml',
        'electron-builder.config.js',
        'electron-builder.config.ts',
        'electron-builder.config.mjs',
        'electron-builder.config.cjs',
        'electron-builder.config.mts',
        'electron-builder.config.cts',
      ];
      expect(spy).toHaveBeenCalledTimes(expected.length);
      assert.deepEqual(accessedFilenames.sort(), expected.sort());
    });

    it.each([
      ['CJS', 'cjs-config'], // .config.cjs (Function)
      ['CTS', 'cts-config'], // .config.cts (Object)
      ['Inline', 'inline-config'], // no config file
      ['JS', 'js-config'], // .config.js (Function)
      ['MJS', 'mjs-config'], // .config.mjs (Object)
      ['MTS', 'mts-config'], // .config.mts (Object)
      ['JSON', 'json-config'], // .config.json
      ['JSON5', 'json5-config'], // .config.json5
      ['TOML', 'toml-config'], // .config.toml
      ['TS', 'ts-fn-config'], // .config.ts (Function)
      ['TS', 'ts-obj-config'], // .config.ts (Object)
      ['YAML (.yaml)', 'yaml-config'], // .config.yaml
      ['YAML (.yml)', 'yml-config'], // .config.yml
    ])(
      'should return the expected config for a builder dependency with %s config - ESM',
      async (_key, builderFixtureName) => {
        const fixtureName = `builder-dependency-${builderFixtureName}`;
        vi.mocked(fs.access).mockRestore();

        const packageJsonPath = getFixturePackagePath('esm', fixtureName);
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        await expect(
          await getAppBuildInfo({
            packageJson,
            path: packageJsonPath,
          }),
        ).toStrictEqual({
          appName: fixtureName,
          config: { productName: fixtureName },
          isBuilder: true,
          isForge: false,
        });
      },
    );

    it('should return the expected config when there is no app name in the build tool config', async () => {
      const packageJsonPath = getFixturePackagePath('esm', 'no-app-name-in-build-tool-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(
        await getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).toStrictEqual({
        appName: 'fixture-esm_no-app-name-in-build-tool-config',
        config: { appId: 'no-app-name-in-build-tool-config' },
        isBuilder: true,
        isForge: false,
      });
    });

    it('should return the expected config for a Forge dependency with inline config', async () => {
      const packageJsonPath = getFixturePackagePath('esm', 'forge-dependency-inline-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(
        await getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).toStrictEqual({
        appName: 'forge-dependency-inline-config',
        config: { packagerConfig: { name: 'forge-dependency-inline-config' } },
        isBuilder: false,
        isForge: true,
      });
    });

    it('should return the expected config when configuration for multiple build tools are found', async () => {
      const packageJsonPath = getFixturePackagePath('esm', 'multiple-build-tools-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(
        await getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).toStrictEqual({
        appName: 'multiple-build-tools-config',
        config: { packagerConfig: { name: 'multiple-build-tools-config' } },
        isBuilder: false,
        isForge: true,
      });
    });
  });

  describe('CJS', () => {
    it('should throw an error when no build tools are found', async () => {
      const packageJsonPath = getFixturePackagePath('cjs', 'no-build-tool');
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
      const packageJsonPath = getFixturePackagePath('cjs', 'multiple-build-tools-no-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).rejects.toThrow(/Forge was detected but no configuration was found at '(.*)forge.config.js'./);
    });

    it('should throw an error when the Forge app name is unable to be determined', async () => {
      const packageJsonPath = getFixturePackagePath('cjs', 'forge-dependency-inline-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      delete packageJson.name;
      delete packageJson.config.forge.packagerConfig;
      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).rejects.toThrow(
        'No application name was detected, please set name / productName in your package.json or build tool configuration.',
      );
    });

    it('should throw an error when the builder app name is unable to be determined', async () => {
      const packageJsonPath = getFixturePackagePath('cjs', 'builder-dependency-inline-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      delete packageJson.name;
      delete packageJson.build.productName;
      await expect(() =>
        getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).rejects.toThrow(
        'No application name was detected, please set name / productName in your package.json or build tool configuration.',
      );
    });

    it('should throw an error when builder is detected but has no config', async () => {
      const packageJsonPath = getFixturePackagePath('cjs', 'builder-dependency-no-config');
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
      const packageJsonPath = getFixturePackagePath('cjs', 'forge-dependency-no-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(
        getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).rejects.toThrow(/Forge was detected but no configuration was found at '(.*)forge.config.js'./);
    });

    it('should throw an error when Forge is detected with a linked JS config but the config file cannot be read', async () => {
      const packageJsonPath = getFixturePackagePath('cjs', 'forge-dependency-linked-js-config-broken');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(
        getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).rejects.toThrow(/Forge was detected but no configuration was found at '(.*)custom-config.js'./);
    });

    it('should return the expected config when configuration for builder is found alongside a Forge dependency', async () => {
      const packageJsonPath = getFixturePackagePath('cjs', 'multiple-build-tools-wrong-config-1');
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
      const packageJsonPath = getFixturePackagePath('cjs', 'multiple-build-tools-wrong-config-2');
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
      const packageJsonPath = getFixturePackagePath('cjs', 'forge-dependency-js-config');
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
      const packageJsonPath = getFixturePackagePath('cjs', 'forge-dependency-linked-js-config');
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
      const packageJsonPath = getFixturePackagePath('cjs', 'builder-dependency-no-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      const spy = vi.spyOn(fs, 'access');
      try {
        await getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        });
      } catch (_e) {
        // An error will always occur because the configuration file does not exist.
        // Ignore errors to test to ensure all expected filename patterns are covered
      }
      const accessedFilenames = spy.mock.calls.map((call) => {
        if (typeof call[0] === 'string') {
          return path.basename(call[0]);
        }
        assert.fail(`fs.access called with a non-string value: ${call[0]}`);
      });
      const expected = [
        'electron-builder.json',
        'electron-builder.json5',
        'electron-builder.yml',
        'electron-builder.yaml',
        'electron-builder.toml',
        'electron-builder.js',
        'electron-builder.ts',
        'electron-builder.mjs',
        'electron-builder.cjs',
        'electron-builder.mts',
        'electron-builder.cts',
        'electron-builder.config.json',
        'electron-builder.config.json5',
        'electron-builder.config.yml',
        'electron-builder.config.yaml',
        'electron-builder.config.toml',
        'electron-builder.config.js',
        'electron-builder.config.ts',
        'electron-builder.config.mjs',
        'electron-builder.config.cjs',
        'electron-builder.config.mts',
        'electron-builder.config.cts',
      ];
      expect(spy).toHaveBeenCalledTimes(expected.length);
      assert.deepEqual(accessedFilenames.sort(), expected.sort());
    });

    it.each([
      ['CJS', 'cjs-config'], // .config.cjs (Function)
      ['CTS', 'cts-config'], // .config.cts (Object)
      ['Inline', 'inline-config'], // no config file
      ['JS', 'js-config'], // .config.js (Function)
      ['MJS', 'mjs-config'], // .config.mjs (Object)
      ['MTS', 'mts-config'], // .config.mts (Object)
      ['JSON', 'json-config'], // .config.json
      ['JSON5', 'json5-config'], // .config.json5
      ['TOML', 'toml-config'], // .config.toml
      ['TS (fn)', 'ts-fn-config'], // .config.ts (Function)
      ['TS (obj)', 'ts-obj-config'], // .config.ts (Object)
      ['YAML (.yaml)', 'yaml-config'], // .config.yaml
      ['YAML (.yml)', 'yml-config'], // .config.yml
    ])(
      'should return the expected config for a builder dependency with %s config',
      async (_key, builderFixtureName) => {
        const fixtureName = `builder-dependency-${builderFixtureName}`;
        vi.mocked(fs.access).mockRestore();

        const packageJsonPath = getFixturePackagePath('cjs', fixtureName);
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        await expect(
          await getAppBuildInfo({
            packageJson,
            path: packageJsonPath,
          }),
        ).toStrictEqual({
          appName: fixtureName,
          config: { productName: fixtureName },
          isBuilder: true,
          isForge: false,
        });
      },
    );

    it('should return the expected config when there is no app name in the build tool config', async () => {
      const packageJsonPath = getFixturePackagePath('cjs', 'no-app-name-in-build-tool-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(
        await getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).toStrictEqual({
        appName: 'fixture-cjs_no-app-name-in-build-tool-config',
        config: { appId: 'no-app-name-in-build-tool-config' },
        isBuilder: true,
        isForge: false,
      });
    });

    it('should return the expected config for a Forge dependency with inline config', async () => {
      const packageJsonPath = getFixturePackagePath('cjs', 'forge-dependency-inline-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(
        await getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).toStrictEqual({
        appName: 'forge-dependency-inline-config',
        config: { packagerConfig: { name: 'forge-dependency-inline-config' } },
        isBuilder: false,
        isForge: true,
      });
    });

    it('should return the expected config when configuration for multiple build tools are found', async () => {
      const packageJsonPath = getFixturePackagePath('cjs', 'multiple-build-tools-config');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      await expect(
        await getAppBuildInfo({
          packageJson,
          path: packageJsonPath,
        }),
      ).toStrictEqual({
        appName: 'multiple-build-tools-config',
        config: { packagerConfig: { name: 'multiple-build-tools-config' } },
        isBuilder: false,
        isForge: true,
      });
    });
  });
});

describe('getElectronVersion', () => {
  it('should return the electron version from package.json dependencies', async () => {
    const pkg = {
      packageJson: {
        name: 'my-app',
        version: '1.0.0',
        dependencies: {
          electron: '^29.4.1',
        },
      } as Omit<NormalizedPackageJson, 'readme' | '_id'>,
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBe('29.4.1');
  });

  it('should return the electron version from package.json devDependencies', async () => {
    const pkg = {
      packageJson: {
        name: 'my-app',
        version: '1.0.0',
        devDependencies: {
          electron: '^29.4.1',
        },
      } as Omit<NormalizedPackageJson, 'readme' | '_id'>,
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBe('29.4.1');
  });

  it('should return the nightly electron version from package.json dependencies', async () => {
    const pkg = {
      packageJson: {
        name: 'my-app',
        version: '1.0.0',
        dependencies: {
          'electron-nightly': '33.0.0-nightly.20240621',
        },
      } as Omit<NormalizedPackageJson, 'readme' | '_id'>,
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBe('33.0.0-nightly.20240621');
  });

  it('should return the nightly electron version from package.json devDependencies', async () => {
    const pkg = {
      packageJson: {
        name: 'my-app',
        version: '1.0.0',
        devDependencies: {
          'electron-nightly': '33.0.0-nightly.20240621',
        },
      } as Omit<NormalizedPackageJson, 'readme' | '_id'>,
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBe('33.0.0-nightly.20240621');
  });

  it('should return undefined when there is no electron dependency', async () => {
    const pkg = {
      packageJson: {
        name: 'my-app',
        version: '1.0.0',
        dependencies: {},
      } as Omit<NormalizedPackageJson, 'readme' | '_id'>,
      path: '/path/to/package.json',
    } as NormalizedReadResult;
    const version = await getElectronVersion(pkg);
    expect(version).toBeUndefined();
  });
});
