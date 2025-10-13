import { access } from 'node:fs/promises';
import path from 'node:path';
import type { BinaryPathResult, ElectronServiceOptions } from '@wdio/electron-types';
import type { Capabilities, Options } from '@wdio/types';
import getPort from 'get-port';
import nock from 'nock';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import ElectronLaunchService from '../src/launcher.js';
import { mockProcessProperty, revertProcessProperty } from './helpers.js';
import { getAppBuildInfo, getBinaryPath, getElectronVersion, getMockLogger } from './mocks/electron-utils.js';

let LaunchService: typeof ElectronLaunchService;
let instance: ElectronLaunchService | undefined;
let options: ElectronServiceOptions;

function getFixtureDir(fixtureType: string, fixtureName: string) {
  return path.join(process.cwd(), '..', '..', 'fixtures', fixtureType, fixtureName);
}

vi.mock('node:fs/promises', () => {
  const mockAccessFn = vi.fn().mockResolvedValue(undefined);
  return {
    access: mockAccessFn,
    default: {
      access: mockAccessFn,
    },
  };
});
vi.mock('@wdio/electron-utils', async () => {
  const mockUtilsModule = await import('./mocks/electron-utils.js');

  // Configure the specific mocks needed for launcher tests
  mockUtilsModule.getBinaryPath.mockResolvedValue({
    success: true,
    binaryPath: 'workspace/my-test-app/dist/my-test-app',
    pathGeneration: {
      success: true,
      paths: ['workspace/my-test-app/dist/my-test-app'],
      errors: [],
    },
    pathValidation: {
      success: true,
      validPath: 'workspace/my-test-app/dist/my-test-app',
      attempts: [
        {
          path: 'workspace/my-test-app/dist/my-test-app',
          valid: true,
        },
      ],
    },
  } as BinaryPathResult);

  mockUtilsModule.getAppBuildInfo.mockResolvedValue({
    appName: 'my-test-app',
    isForge: true,
    config: {},
  });

  // Default getElectronVersion mock - returns a version >= 26 by default
  mockUtilsModule.getElectronVersion.mockResolvedValue('30.0.0');

  return mockUtilsModule;
});

// Log mock is included in the main @wdio/electron-utils mock above

vi.mock('get-port', async () => {
  return {
    default: vi.fn(),
  };
});

beforeEach(async () => {
  mockProcessProperty('platform', 'darwin');
  LaunchService = (await import('../src/launcher.js')).default;
  options = {
    appBinaryPath: 'workspace/my-test-app/dist/my-test-app',
    appArgs: [],
  };
  nock('https://electronjs.org')
    .get('/headers/index.json')
    .reply(200, [
      {
        version: '25.0.0',
        chrome: '114.0.5735.45',
      },
      {
        version: '26.0.0',
        chrome: '116.0.5845.82',
      },
      {
        version: '26.2.2',
        chrome: '116.0.5845.190',
      },
      {
        version: '32.0.1',
        chrome: '128.0.6613.36',
      },
    ]);
});

afterEach(() => {
  instance = undefined;
  revertProcessProperty('platform');
  vi.mocked(access).mockReset().mockResolvedValue(undefined);
});

describe('Electron Launch Service', () => {
  describe('onPrepare()', () => {
    beforeEach(() => {
      instance = new LaunchService(
        options,
        [] as never,
        {
          services: [['electron', options]],
        } as Options.Testrunner,
      );
    });

    it('should throw an error when there is no electron browser in capabilities', async () => {
      const capabilities: WebdriverIO.Capabilities[] = [
        {
          browserName: 'chrome',
          browserVersion: '26.2.2',
        },
      ];
      await expect(() => instance?.onPrepare({} as never, capabilities)).rejects.toThrow(
        'No Electron browser found in capabilities',
      );
    });

    describe('package scenarios', () => {
      it('should throw an error when the local Electron version is older than v26 and Chromedriver is not configured manually', async () => {
        // Mock old electron version for this test
        (getElectronVersion as Mock).mockResolvedValueOnce('25.0.0');

        instance = new LaunchService(
          options,
          [] as never,
          {
            services: [['electron', options]],
            rootDir: getFixtureDir('package-scenarios', 'old-electron'),
          } as Options.Testrunner,
        );
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
          },
        ];
        await expect(() => instance?.onPrepare({} as never, capabilities)).rejects.toThrow(
          'Electron version must be 26 or higher for auto-configuration of Chromedriver.  If you want to use an older version of Electron, you must configure Chromedriver manually using the wdio:chromedriverOptions capability',
        );
      });

      it('should not throw an error when the local Electron version is older than v26 and Chromedriver is configured manually', async () => {
        // Mock old electron version for this test
        (getElectronVersion as Mock).mockResolvedValueOnce('25.0.0');

        instance = new LaunchService(
          options,
          [] as never,
          {
            services: [['electron', options]],
            rootDir: getFixtureDir('package-scenarios', 'old-electron'),
          } as Options.Testrunner,
        );
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
            'wdio:chromedriverOptions': {
              binary: '/path/to/chromedriver',
            },
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          browserName: 'chrome',
          browserVersion: '114.0.5735.45',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/my-test-app',
            windowTypes: ['app', 'webview'],
          },
          'wdio:chromedriverOptions': {
            binary: '/path/to/chromedriver',
          },
          'wdio:electronServiceOptions': {},
          'wdio:enforceWebDriverClassic': true,
        });
      });

      it('should throw an error when appBinaryPath is not specified and no build tool is found', async () => {
        delete options.appBinaryPath;
        (getAppBuildInfo as Mock).mockRejectedValueOnce(new Error('b0rk - no build tool found'));
        instance = new LaunchService(
          options,
          [] as never,
          {
            rootDir: getFixtureDir('package-scenarios', 'no-build-tool'),
            services: [['electron', options]],
          } as Options.Testrunner,
        );
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
            browserVersion: '26.2.2',
            'wdio:electronServiceOptions': {
              appArgs: ['some', 'args'],
            },
          },
        ];
        await expect(() => instance?.onPrepare({} as never, capabilities)).rejects.toThrow(
          'b0rk - no build tool found',
        );
      });

      it('should use appEntryPoint when both appEntryPoint and appBinaryPath are set', async () => {
        options.appEntryPoint = './path/to/bundled/electron/main.bundle.js';
        instance = new LaunchService(
          options,
          [] as never,
          {
            services: [['electron', options]],
            rootDir: getFixtureDir('package-scenarios', 'no-build-tool'),
          } as Options.Testrunner,
        );
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
            browserVersion: '26.2.2',
            'wdio:electronServiceOptions': {
              appArgs: ['some', 'args'],
            },
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        const mockLogger = getMockLogger('launcher');
        expect(mockLogger?.info).toHaveBeenCalledWith(
          'Both appEntryPoint and appBinaryPath are set, using appEntryPoint (appBinaryPath ignored)',
        );
      });

      it('should throw an error when the detected app path does not exist for a Forge dependency', async () => {
        delete options.appBinaryPath;
        (getBinaryPath as Mock).mockResolvedValueOnce({
          success: false,
          binaryPath: undefined,
          pathGeneration: {
            success: true,
            paths: [
              '/Users/sam/Workspace/wdio-electron-service/fixtures/config-formats/forge-dependency-inline-config/out/my-test-app-darwin-x64/my-test-app.app/Contents/MacOS/my-test-app',
              '/Users/sam/Workspace/wdio-electron-service/fixtures/config-formats/forge-dependency-inline-config/out/my-test-app-darwin-arm64/my-test-app.app/Contents/MacOS/my-test-app',
              '/Users/sam/Workspace/wdio-electron-service/fixtures/config-formats/forge-dependency-inline-config/out/my-test-app-darwin-universal/my-test-app.app/Contents/MacOS/my-test-app',
            ],
            errors: [],
          },
          pathValidation: {
            success: false,
            validPath: undefined,
            attempts: [
              {
                path: '/Users/sam/Workspace/wdio-electron-service/fixtures/config-formats/forge-dependency-inline-config/out/my-test-app-darwin-x64/my-test-app.app/Contents/MacOS/my-test-app',
                valid: false,
                error: {
                  type: 'FILE_NOT_FOUND',
                  message: 'ENOENT: no such file or directory',
                  code: 'ENOENT',
                },
              },
              {
                path: '/Users/sam/Workspace/wdio-electron-service/fixtures/config-formats/forge-dependency-inline-config/out/my-test-app-darwin-arm64/my-test-app.app/Contents/MacOS/my-test-app',
                valid: false,
                error: {
                  type: 'FILE_NOT_FOUND',
                  message: 'ENOENT: no such file or directory',
                  code: 'ENOENT',
                },
              },
              {
                path: '/Users/sam/Workspace/wdio-electron-service/fixtures/config-formats/forge-dependency-inline-config/out/my-test-app-darwin-universal/my-test-app.app/Contents/MacOS/my-test-app',
                valid: false,
                error: {
                  type: 'FILE_NOT_FOUND',
                  message: 'ENOENT: no such file or directory',
                  code: 'ENOENT',
                },
              },
            ],
          },
        } as BinaryPathResult);
        instance = new LaunchService(
          options,
          [] as never,
          {
            services: [['electron', options]],
            rootDir: getFixtureDir('config-formats', 'forge-dependency-inline-config'),
          } as Options.Testrunner,
        );
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
            browserVersion: '26.2.2',
            'wdio:electronServiceOptions': {
              appArgs: ['some', 'args'],
            },
          },
        ];
        await expect(() => instance?.onPrepare({} as never, capabilities)).rejects.toThrow(
          /Failed setting up Electron session:.*Could not find Electron app built with Electron Forge!/s,
        );
      });

      it('should throw an error when the detected app path does not exist for an electron-builder dependency', async () => {
        delete options.appBinaryPath;
        (getBinaryPath as Mock).mockResolvedValueOnce({
          success: false,
          binaryPath: undefined,
          pathGeneration: {
            success: true,
            paths: ['<expected binary path>'],
            errors: [],
          },
          pathValidation: {
            success: false,
            validPath: undefined,
            attempts: [
              {
                path: '<expected binary path>',
                valid: false,
                error: {
                  type: 'FILE_NOT_FOUND',
                  message: 'ENOENT: no such file or directory',
                  code: 'ENOENT',
                },
              },
            ],
          },
        } as BinaryPathResult);
        (getAppBuildInfo as Mock).mockResolvedValueOnce({
          appName: 'my-test-app',
          isForge: false,
          config: {},
        });
        instance = new LaunchService(
          options,
          [] as never,
          {
            services: [['electron', options]],
            rootDir: getFixtureDir('config-formats', 'builder-dependency-inline-config'),
          } as Options.Testrunner,
        );
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
            browserVersion: '26.2.2',
            'wdio:electronServiceOptions': {
              appArgs: ['some', 'args'],
            },
          },
        ];
        await expect(() => instance?.onPrepare({} as never, capabilities)).rejects.toThrow(
          /Failed setting up Electron session:.*Could not find Electron app built with electron-builder!/s,
        );
      });

      it('should override global options with capabilities', async () => {
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
            browserVersion: '26.2.2',
            'wdio:electronServiceOptions': {
              appBinaryPath: 'workspace/my-other-test-app/dist/my-other-test-app',
            },
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          browserName: 'chrome',
          browserVersion: '116.0.5845.190',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-other-test-app/dist/my-other-test-app',
            windowTypes: ['app', 'webview'],
          },
          'wdio:electronServiceOptions': {
            appBinaryPath: 'workspace/my-other-test-app/dist/my-other-test-app',
          },
          'wdio:enforceWebDriverClassic': true,
        });
      });

      it('should pass through browserVersion', async () => {
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
            browserVersion: 'some-version',
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          browserName: 'chrome',
          browserVersion: 'some-version',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/my-test-app',
            windowTypes: ['app', 'webview'],
          },
          'wdio:electronServiceOptions': {},
          'wdio:enforceWebDriverClassic': true,
        });
      });

      it('should use the Electron version from the local package dependencies when browserVersion is not provided', async () => {
        // Mock electron version that matches the expected chrome version
        (getElectronVersion as Mock).mockResolvedValueOnce('26.0.0');

        instance = new LaunchService(
          options,
          [] as never,
          {
            services: [['electron', options]],
            rootDir: getFixtureDir('package-scenarios', 'electron-in-dependencies'),
          } as Options.Testrunner,
        );
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          browserName: 'chrome',
          browserVersion: '116.0.5845.82',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/my-test-app',
            windowTypes: ['app', 'webview'],
          },
          'wdio:electronServiceOptions': {},
          'wdio:enforceWebDriverClassic': true,
        });
      });

      it('should use the Electron version from the nearest package dependencies when browserVersion is not provided', async () => {
        // Mock electron version that matches the expected chrome version
        (getElectronVersion as Mock).mockResolvedValueOnce('26.0.0');

        instance = new LaunchService(
          options,
          [] as never,
          {
            services: [['electron', options]],
            rootDir: path.join(getFixtureDir('package-scenarios', 'electron-in-dependencies'), 'subpackage', 'subdir'),
          } as Options.Testrunner,
        );
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          browserName: 'chrome',
          browserVersion: '116.0.5845.82',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/my-test-app',
            windowTypes: ['app', 'webview'],
          },
          'wdio:electronServiceOptions': {},
          'wdio:enforceWebDriverClassic': true,
        });
      });

      it('should use the Electron version from the local package devDependencies when browserVersion is not provided', async () => {
        // Mock electron version that matches the expected chrome version
        (getElectronVersion as Mock).mockResolvedValueOnce('26.0.0');

        instance = new LaunchService(
          options,
          [] as never,
          {
            services: [['electron', options]],
            rootDir: getFixtureDir('package-scenarios', 'electron-in-dev-dependencies'),
          } as Options.Testrunner,
        );
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          browserName: 'chrome',
          browserVersion: '116.0.5845.82',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/my-test-app',
            windowTypes: ['app', 'webview'],
          },
          'wdio:electronServiceOptions': {},
          'wdio:enforceWebDriverClassic': true,
        });
      });

      it('should use the Electron version from the nearest package devDependencies when browserVersion is not provided', async () => {
        // Mock electron version that matches the expected chrome version
        (getElectronVersion as Mock).mockResolvedValueOnce('26.0.0');

        instance = new LaunchService(
          options,
          [] as never,
          {
            services: [['electron', options]],
            rootDir: path.join(
              getFixtureDir('package-scenarios', 'electron-in-dev-dependencies'),
              'subpackage',
              'subdir',
            ),
          } as Options.Testrunner,
        );
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          browserName: 'chrome',
          browserVersion: '116.0.5845.82',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/my-test-app',
            windowTypes: ['app', 'webview'],
          },
          'wdio:electronServiceOptions': {},
          'wdio:enforceWebDriverClassic': true,
        });
      });

      it('should throw an error when browserVersion is not provided and there is no local Electron version', async () => {
        instance = new LaunchService(
          options,
          [] as never,
          {
            services: [['electron', options]],
            rootDir: getFixtureDir('package-scenarios', 'no-electron'),
          } as Options.Testrunner,
        );
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
          },
        ];
        await expect(() => instance?.onPrepare({} as never, capabilities)).rejects.toThrow(
          'Failed setting up Electron session: Error: You must install Electron locally, or provide a custom Chromedriver path / browserVersion value for each Electron capability',
        );
      });

      it('should set the expected capabilities', async () => {
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
            browserVersion: '26.2.2',
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          browserName: 'chrome',
          browserVersion: '116.0.5845.190',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/my-test-app',
            windowTypes: ['app', 'webview'],
          },
          'wdio:electronServiceOptions': {},
          'wdio:enforceWebDriverClassic': true,
        });
      });

      it('should apply `--no-sandbox` to the app when appArgs is not set', async () => {
        delete options.appArgs;
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
            browserVersion: '26.2.2',
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          browserName: 'chrome',
          browserVersion: '116.0.5845.190',
          'goog:chromeOptions': {
            args: ['--no-sandbox'],
            binary: 'workspace/my-test-app/dist/my-test-app',
            windowTypes: ['app', 'webview'],
          },
          'wdio:electronServiceOptions': {},
          'wdio:enforceWebDriverClassic': true,
        });
      });

      it('should set the expected capabilities when the detected app path exists for a Forge dependency', async () => {
        delete options.appBinaryPath;
        (getBinaryPath as Mock).mockResolvedValueOnce({
          success: true,
          binaryPath: 'workspace/my-test-app/out/my-test-app',
          pathGeneration: {
            success: true,
            paths: ['workspace/my-test-app/out/my-test-app'],
            errors: [],
          },
          pathValidation: {
            success: true,
            validPath: 'workspace/my-test-app/out/my-test-app',
            attempts: [
              {
                path: 'workspace/my-test-app/out/my-test-app',
                valid: true,
              },
            ],
          },
        } as BinaryPathResult);
        instance = new LaunchService(
          options,
          [] as never,
          {
            services: [['electron', options]],
            rootDir: getFixtureDir('config-formats', 'forge-dependency-inline-config'),
          } as Options.Testrunner,
        );
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
            browserVersion: '26.2.2',
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          browserName: 'chrome',
          browserVersion: '116.0.5845.190',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/out/my-test-app',
            windowTypes: ['app', 'webview'],
          },
          'wdio:electronServiceOptions': {},
          'wdio:enforceWebDriverClassic': true,
        });
      });

      it('should set the expected capabilities when the detected app path exists for an electron-builder dependency', async () => {
        delete options.appBinaryPath;
        (getBinaryPath as Mock).mockResolvedValueOnce({
          success: true,
          binaryPath: 'workspace/my-test-app/dist/my-test-app',
          pathGeneration: {
            success: true,
            paths: ['workspace/my-test-app/dist/my-test-app'],
            errors: [],
          },
          pathValidation: {
            success: true,
            validPath: 'workspace/my-test-app/dist/my-test-app',
            attempts: [
              {
                path: 'workspace/my-test-app/dist/my-test-app',
                valid: true,
              },
            ],
          },
        } as BinaryPathResult);
        (getAppBuildInfo as Mock).mockResolvedValueOnce({
          appName: 'my-test-app',
          isForge: false,
          config: {},
        });
        instance = new LaunchService(
          options,
          [] as never,
          {
            services: [['electron', options]],
            rootDir: getFixtureDir('config-formats', 'builder-dependency-inline-config'),
          } as Options.Testrunner,
        );
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
            browserVersion: '26.2.2',
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          browserName: 'chrome',
          browserVersion: '116.0.5845.190',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/my-test-app',
            windowTypes: ['app', 'webview'],
          },
          'wdio:electronServiceOptions': {},
          'wdio:enforceWebDriverClassic': true,
        });
      });

      it('should set the expected capabilities when setting appEntryPoint', async () => {
        delete options.appBinaryPath;
        options.appEntryPoint = 'path/to/main.bundle.js';
        instance = new LaunchService(
          options,
          [] as never,
          {
            services: [['electron', options]],
            rootDir: getFixtureDir('package-scenarios', 'no-build-tool'),
          } as Options.Testrunner,
        );
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
            browserVersion: '26.2.2',
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          browserName: 'chrome',
          browserVersion: '116.0.5845.190',
          'goog:chromeOptions': {
            args: ['--app=path/to/main.bundle.js'],
            binary: path.join(getFixtureDir('package-scenarios', 'no-build-tool'), 'node_modules', '.bin', 'electron'),
            windowTypes: ['app', 'webview'],
          },
          'wdio:electronServiceOptions': {},
          'wdio:enforceWebDriverClassic': true,
        });
      });

      it('should use readPackageUp result for electron binary path with appEntryPoint instead of rootDir', async () => {
        // Mock readPackageUp before importing the module
        const mockPackage = {
          packageJson: {
            dependencies: { electron: '^26.0.0' },
            devDependencies: {},
            name: 'test-package',
            version: '1.0.0',
          },
          path: '/different/path/to/package.json',
        };

        vi.doMock('read-package-up', () => ({
          readPackageUp: vi.fn().mockResolvedValue(mockPackage),
        }));

        // Clear module cache to ensure our mock is used
        vi.resetModules();

        // Now import the module after setting up the mock
        const { default: LaunchService } = await import('../src/launcher.js');

        delete options.appBinaryPath;
        options.appEntryPoint = 'path/to/main.bundle.js';

        // Create instance with a different rootDir to ensure we don't use it
        instance = new LaunchService(
          options,
          [] as never,
          {
            services: [['electron', options]],
            rootDir: '/completely/different/root/dir',
          } as Options.Testrunner,
        );

        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
            browserVersion: '26.2.2',
          },
        ];

        await instance?.onPrepare({} as never, capabilities);

        // Verify that binary path uses the directory from readPackageUp result, not rootDir
        expect(capabilities[0]['goog:chromeOptions']?.binary).toBe(
          path.join(
            '/different/path/to',
            'node_modules',
            '.bin',
            process.platform === 'win32' ? 'electron.CMD' : 'electron',
          ),
        );

        vi.resetModules();
        vi.clearAllMocks();
      });

      it('should set the expected capabilities when setting custom chromedriverOptions', async () => {
        const capabilities: WebdriverIO.Capabilities[] = [
          {
            browserName: 'electron',
            browserVersion: '26.2.2',
            'wdio:chromedriverOptions': {
              binary: '/path/to/chromedriver',
            },
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          browserName: 'chrome',
          browserVersion: '116.0.5845.190',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/my-test-app',
            windowTypes: ['app', 'webview'],
          },
          'wdio:chromedriverOptions': {
            binary: '/path/to/chromedriver',
          },
          'wdio:electronServiceOptions': {},
          'wdio:enforceWebDriverClassic': true,
        });
      });

      it('should set the expected capabilities when W3C-specific', async () => {
        const capabilities: Capabilities.W3CCapabilities[] = [
          {
            firstMatch: [],
            alwaysMatch: {
              browserName: 'electron',
              browserVersion: '26.2.2',
            },
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          firstMatch: [],
          alwaysMatch: {
            browserName: 'chrome',
            browserVersion: '116.0.5845.190',
            'goog:chromeOptions': {
              args: [],
              binary: 'workspace/my-test-app/dist/my-test-app',
              windowTypes: ['app', 'webview'],
            },
            'wdio:electronServiceOptions': {},
            'wdio:enforceWebDriverClassic': true,
          },
        });
      });

      it('should set the expected capabilities when multiremote', async () => {
        const capabilities = {
          firefox: {
            capabilities: {
              browserName: 'firefox',
            },
          },
          myElectronProject: {
            capabilities: {
              browserName: 'electron',
              browserVersion: '32.0.1',
            },
          },
          chrome: {
            capabilities: {
              browserName: 'chrome',
            },
          },
          myOtherElectronProject: {
            capabilities: {
              firstMatch: [],
              alwaysMatch: {
                browserName: 'electron',
                browserVersion: '26.2.2',
              },
            },
          },
        };
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities).toEqual({
          firefox: {
            capabilities: {
              browserName: 'firefox',
            },
          },
          myElectronProject: {
            capabilities: {
              browserName: 'chrome',
              browserVersion: '128.0.6613.36',
              'goog:chromeOptions': {
                args: [],
                binary: 'workspace/my-test-app/dist/my-test-app',
                windowTypes: ['app', 'webview'],
              },
              'wdio:electronServiceOptions': {},
              'wdio:enforceWebDriverClassic': true,
            },
          },
          chrome: {
            capabilities: {
              browserName: 'chrome',
            },
          },
          myOtherElectronProject: {
            capabilities: {
              firstMatch: [],
              alwaysMatch: {
                browserName: 'chrome',
                browserVersion: '116.0.5845.190',
                'goog:chromeOptions': {
                  args: [],
                  binary: 'workspace/my-test-app/dist/my-test-app',
                  windowTypes: ['app', 'webview'],
                },
                'wdio:electronServiceOptions': {},
                'wdio:enforceWebDriverClassic': true,
              },
            },
          },
        });
      });

      it('should set the expected capabilities when parallel multiremote', async () => {
        const capabilities: Capabilities.RequestedMultiremoteCapabilities[] = [
          {
            firefox: {
              capabilities: {
                browserName: 'firefox',
              },
            },
            myElectronProject: {
              capabilities: {
                browserName: 'electron',
                browserVersion: '32.0.1',
              },
            },
          },
          {
            chrome: {
              capabilities: {
                browserName: 'chrome',
              },
            },
            myOtherElectronProject: {
              capabilities: {
                firstMatch: [],
                alwaysMatch: {
                  browserName: 'electron',
                  browserVersion: '26.2.2',
                },
              },
            },
          },
        ];
        await instance?.onPrepare({} as never, capabilities);
        expect(capabilities).toEqual([
          {
            firefox: {
              capabilities: {
                browserName: 'firefox',
              },
            },
            myElectronProject: {
              capabilities: {
                browserName: 'chrome',
                browserVersion: '128.0.6613.36',
                'goog:chromeOptions': {
                  args: [],
                  binary: 'workspace/my-test-app/dist/my-test-app',
                  windowTypes: ['app', 'webview'],
                },
                'wdio:electronServiceOptions': {},
                'wdio:enforceWebDriverClassic': true,
              },
            },
          },
          {
            chrome: {
              capabilities: {
                browserName: 'chrome',
              },
            },
            myOtherElectronProject: {
              capabilities: {
                firstMatch: [],
                alwaysMatch: {
                  browserName: 'chrome',
                  browserVersion: '116.0.5845.190',
                  'goog:chromeOptions': {
                    args: [],
                    binary: 'workspace/my-test-app/dist/my-test-app',
                    windowTypes: ['app', 'webview'],
                  },
                  'wdio:electronServiceOptions': {},
                  'wdio:enforceWebDriverClassic': true,
                },
              },
            },
          },
        ]);
      });
    });
  });
  describe('onWorkerStart', () => {
    let counter = 0;

    beforeEach(() => {
      counter = 0;
      (getPort as Mock).mockImplementation(() => {
        return 50000 + counter++;
      });
    });

    const baseCapability = {
      browserName: 'chrome',
      browserVersion: '116.0.5845.190',
      'goog:chromeOptions': {
        args: ['foo=bar'],
        binary: 'workspace/my-test-app/out/my-test-app',
        windowTypes: ['app', 'webview'],
      },
      'wdio:electronServiceOptions': {},
      'wdio:enforceWebDriverClassic': true,
    };

    describe('Standard', () => {
      it('should apply `--inspect` to the args of `goog:chromeOptions`', async () => {
        instance = new ElectronLaunchService({}, {}, {});
        const capabilities = baseCapability;
        const expectedCaps = structuredClone(capabilities);
        expectedCaps['goog:chromeOptions'].args.push('--inspect=localhost:50000');

        await instance?.onWorkerStart('0', capabilities);
        expect(capabilities).toStrictEqual(expectedCaps);
      });

      it('should apply `--inspect` if `goog:chromeOptions` is not set to capability', async () => {
        instance = new ElectronLaunchService({}, {}, {});
        const capabilities = {
          browserName: 'chrome',
          browserVersion: '116.0.5845.190',
          'wdio:electronServiceOptions': {},
          'wdio:enforceWebDriverClassic': true,
        };
        const expectedCaps = Object.assign({}, capabilities, {
          'goog:chromeOptions': {
            args: ['--inspect=localhost:50000'],
          },
        });
        await instance?.onWorkerStart('0', capabilities);
        expect(capabilities).toStrictEqual(expectedCaps);
      });

      it('should apply `--inspect` if `args` is not set to `goog:chromeOptions`', async () => {
        instance = new ElectronLaunchService({}, {}, {});
        const capabilities = {
          browserName: 'chrome',
          browserVersion: '116.0.5845.190',
          'goog:chromeOptions': {
            binary: 'workspace/my-test-app/out/my-test-app',
            windowTypes: ['app', 'webview'],
          },
          'wdio:electronServiceOptions': {},
          'wdio:enforceWebDriverClassic': true,
        };
        const expectedCaps = Object.assign({}, capabilities, {
          'goog:chromeOptions': {
            args: ['--inspect=localhost:50000'],
            binary: 'workspace/my-test-app/out/my-test-app',
            windowTypes: ['app', 'webview'],
          },
        });
        await instance?.onWorkerStart('0', capabilities);
        expect(capabilities).toStrictEqual(expectedCaps);
      });

      it('should throw error when error occurred', async () => {
        instance = new ElectronLaunchService({}, {}, {});
        (getPort as Mock).mockRejectedValue('Some error');
        await expect(() => instance?.onWorkerStart('0', baseCapability)).rejects.toThrowError();
      });
    });

    describe('W3C-specific', () => {
      it('should apply `--inspect` to the args of `goog:chromeOptions`', async () => {
        instance = new ElectronLaunchService({}, {}, {});
        const capabilities = [
          {
            firstMatch: [],
            alwaysMatch: {
              browserName: 'chrome',
              browserVersion: '116.0.5845.190',
              'goog:chromeOptions': {
                args: ['foo=bar'],
                binary: 'workspace/my-test-app/dist/my-test-app',
                windowTypes: ['app', 'webview'],
              },
              'wdio:electronServiceOptions': {},
              'wdio:enforceWebDriverClassic': true,
            },
          },
        ];
        const expectedCaps = structuredClone(capabilities);
        expectedCaps[0].alwaysMatch['goog:chromeOptions'].args.push('--inspect=localhost:50000');

        await instance?.onWorkerStart('0', capabilities as WebdriverIO.Capabilities);
        expect(capabilities).toStrictEqual(expectedCaps);
      });
    });

    describe('Multiremote', async () => {
      it('should apply `--inspect` to the args of `goog:chromeOptions` for the electron', async () => {
        instance = new ElectronLaunchService({}, {}, {});
        const capabilities = {
          firefox: {
            capabilities: {
              browserName: 'firefox',
            },
          },
          myElectronProject: {
            capabilities: baseCapability,
          },
          chrome: {
            capabilities: {
              browserName: 'chrome',
            },
          },
          myOtherElectronProject: {
            capabilities: {
              firstMatch: [],
              alwaysMatch: baseCapability,
            },
          },
        };

        const expectedCaps = structuredClone(capabilities);
        expectedCaps.myElectronProject.capabilities['goog:chromeOptions'].args.push('--inspect=localhost:50000');
        expectedCaps.myOtherElectronProject.capabilities.alwaysMatch['goog:chromeOptions'].args.push(
          '--inspect=localhost:50001',
        );

        await instance?.onWorkerStart('0', capabilities as WebdriverIO.Capabilities);
        expect(capabilities).toStrictEqual(expectedCaps);
      });
    });
  });
});
