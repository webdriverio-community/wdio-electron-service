import path from 'node:path';

import { describe, beforeEach, afterEach, it, expect, vi, Mock } from 'vitest';
import nock from 'nock';
import type { Capabilities, Options } from '@wdio/types';

import ElectronLaunchService from '../src/launcher.js';
import { getAppBuildInfo, getBinaryPath } from '@wdio/electron-utils';
import { mockProcessProperty, revertProcessProperty } from './helpers.js';
import type { ElectronServiceOptions } from '../src/index.js';

let LaunchService: typeof ElectronLaunchService;
let instance: ElectronLaunchService | undefined;
let options: ElectronServiceOptions;

function getFixtureDir(fixtureName: string) {
  return path.join(process.cwd(), '..', '..', 'fixtures', fixtureName);
}

vi.mock('node:fs/promises', () => ({
  default: {
    access: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@wdio/electron-utils', async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getBinaryPath: vi.fn().mockResolvedValue('workspace/my-test-app/dist/my-test-app'),
    getAppBuildInfo: vi.fn().mockResolvedValue({
      appName: 'my-test-app',
      isForge: true,
      config: {},
    }),
  };
});

beforeEach(async () => {
  mockProcessProperty('platform', 'darwin');
  LaunchService = (await import('../src/launcher.js')).default;
  options = {
    appBinaryPath: 'workspace/my-test-app/dist/my-test-app',
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
    ]);
});

afterEach(() => {
  instance = undefined;
  revertProcessProperty('platform');
});

describe('onPrepare', () => {
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

  it('should throw an error when appBinaryPath is not specified and no build tool is found', async () => {
    delete options.appBinaryPath;
    (getAppBuildInfo as Mock).mockRejectedValueOnce(new Error('b0rk - no build tool found'));
    instance = new LaunchService(
      options,
      [] as never,
      {
        rootDir: getFixtureDir('no-build-tool'),
        services: [['electron', options]],
      } as Options.Testrunner,
    );
    const capabilities: WebdriverIO.Capabilities[] = [
      {
        'browserName': 'electron',
        'browserVersion': '26.2.2',
        'wdio:electronServiceOptions': {
          appArgs: ['some', 'args'],
        },
      },
    ];
    await expect(() => instance?.onPrepare({} as never, capabilities)).rejects.toThrow('b0rk - no build tool found');
  });

  it('should throw an error when the detected app path does not exist for a Forge dependency', async () => {
    delete options.appBinaryPath;
    (getBinaryPath as Mock).mockRejectedValueOnce(new Error('b0rk'));
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
        rootDir: getFixtureDir('forge-dependency-inline-config'),
      } as Options.Testrunner,
    );
    const capabilities: WebdriverIO.Capabilities[] = [
      {
        'browserName': 'electron',
        'browserVersion': '26.2.2',
        'wdio:electronServiceOptions': {
          appArgs: ['some', 'args'],
        },
      },
    ];
    await expect(() => instance?.onPrepare({} as never, capabilities)).rejects.toThrow(
      /^Failed setting up Electron session: SevereServiceError: Could not find Electron app at [\S]+ built with Electron Forge!\nIf the application is not compiled, please do so before running your tests, e\.g\. via `npx electron-forge make`\.\nOtherwise if the application is compiled at a different location, please specify the `appBinaryPath` option in your capabilities\.$/m,
    );
  });

  it('should throw an error when the detected app path does not exist for an electron-builder dependency', async () => {
    delete options.appBinaryPath;
    (getBinaryPath as Mock).mockRejectedValueOnce(new Error('b0rk'));
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
        rootDir: getFixtureDir('builder-dependency-inline-config'),
      } as Options.Testrunner,
    );
    const capabilities: WebdriverIO.Capabilities[] = [
      {
        'browserName': 'electron',
        'browserVersion': '26.2.2',
        'wdio:electronServiceOptions': {
          appArgs: ['some', 'args'],
        },
      },
    ];
    await expect(() => instance?.onPrepare({} as never, capabilities)).rejects.toThrow(
      /^Failed setting up Electron session: SevereServiceError: Could not find Electron app at [\S]+ built with electron-builder!\nIf the application is not compiled, please do so before running your tests, e\.g\. via `npx electron-builder build`\.\nOtherwise if the application is compiled at a different location, please specify the `appBinaryPath` option in your capabilities\.$/m,
    );
  });

  it('should override global options with capabilities', async () => {
    const capabilities: WebdriverIO.Capabilities[] = [
      {
        'browserName': 'electron',
        'browserVersion': '26.2.2',
        'wdio:electronServiceOptions': {
          appBinaryPath: 'workspace/my-other-test-app/dist/my-other-test-app',
        },
      },
    ];
    await instance?.onPrepare({} as never, capabilities);
    expect(capabilities[0]).toEqual({
      'browserName': 'chrome',
      'browserVersion': '116.0.5845.190',
      'goog:chromeOptions': {
        args: [],
        binary: 'workspace/my-other-test-app/dist/my-other-test-app',
        windowTypes: ['app', 'webview'],
      },
      'wdio:electronServiceOptions': {
        appBinaryPath: 'workspace/my-other-test-app/dist/my-other-test-app',
      },
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
      'browserName': 'chrome',
      'browserVersion': 'some-version',
      'goog:chromeOptions': {
        args: [],
        binary: 'workspace/my-test-app/dist/my-test-app',
        windowTypes: ['app', 'webview'],
      },
      'wdio:electronServiceOptions': {},
    });
  });

  it('should use the Electron version from the local package dependencies when browserVersion is not provided', async () => {
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
        rootDir: getFixtureDir('electron-in-dependencies'),
      } as Options.Testrunner,
    );
    const capabilities: WebdriverIO.Capabilities[] = [
      {
        browserName: 'electron',
      },
    ];
    await instance?.onPrepare({} as never, capabilities);
    expect(capabilities[0]).toEqual({
      'browserName': 'chrome',
      'browserVersion': '114.0.5735.45',
      'goog:chromeOptions': {
        args: [],
        binary: 'workspace/my-test-app/dist/my-test-app',
        windowTypes: ['app', 'webview'],
      },
      'wdio:electronServiceOptions': {},
    });
  });

  it('should use the Electron version from the nearest package dependencies when browserVersion is not provided', async () => {
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
        rootDir: path.join(getFixtureDir('electron-in-dependencies'), 'subpackage', 'subdir'),
      } as Options.Testrunner,
    );
    const capabilities: WebdriverIO.Capabilities[] = [
      {
        browserName: 'electron',
      },
    ];
    await instance?.onPrepare({} as never, capabilities);
    expect(capabilities[0]).toEqual({
      'browserName': 'chrome',
      'browserVersion': '116.0.5845.82',
      'goog:chromeOptions': {
        args: [],
        binary: 'workspace/my-test-app/dist/my-test-app',
        windowTypes: ['app', 'webview'],
      },
      'wdio:electronServiceOptions': {},
    });
  });

  it('should use the Electron version from the local package devDependencies when browserVersion is not provided', async () => {
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
        rootDir: getFixtureDir('electron-in-dev-dependencies'),
      } as Options.Testrunner,
    );
    const capabilities: WebdriverIO.Capabilities[] = [
      {
        browserName: 'electron',
      },
    ];
    await instance?.onPrepare({} as never, capabilities);
    expect(capabilities[0]).toEqual({
      'browserName': 'chrome',
      'browserVersion': '114.0.5735.45',
      'goog:chromeOptions': {
        args: [],
        binary: 'workspace/my-test-app/dist/my-test-app',
        windowTypes: ['app', 'webview'],
      },
      'wdio:electronServiceOptions': {},
    });
  });

  it('should use the Electron version from the nearest package devDependencies when browserVersion is not provided', async () => {
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
        rootDir: path.join(getFixtureDir('electron-in-dev-dependencies'), 'subpackage', 'subdir'),
      } as Options.Testrunner,
    );
    const capabilities: WebdriverIO.Capabilities[] = [
      {
        browserName: 'electron',
      },
    ];
    await instance?.onPrepare({} as never, capabilities);
    expect(capabilities[0]).toEqual({
      'browserName': 'chrome',
      'browserVersion': '116.0.5845.82',
      'goog:chromeOptions': {
        args: [],
        binary: 'workspace/my-test-app/dist/my-test-app',
        windowTypes: ['app', 'webview'],
      },
      'wdio:electronServiceOptions': {},
    });
  });

  it('should throw an error when browserVersion is not provided and there is no local Electron version', async () => {
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
        rootDir: getFixtureDir('no-electron'),
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
      'browserName': 'chrome',
      'browserVersion': '116.0.5845.190',
      'goog:chromeOptions': {
        args: [],
        binary: 'workspace/my-test-app/dist/my-test-app',
        windowTypes: ['app', 'webview'],
      },
      'wdio:electronServiceOptions': {},
    });
  });

  it('should set the expected capabilities when the detected app path exists for a Forge dependency', async () => {
    delete options.appBinaryPath;
    (getBinaryPath as Mock).mockResolvedValueOnce('workspace/my-test-app/out/my-test-app');
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
        rootDir: getFixtureDir('forge-dependency-inline-config'),
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
      'browserName': 'chrome',
      'browserVersion': '116.0.5845.190',
      'goog:chromeOptions': {
        args: [],
        binary: 'workspace/my-test-app/out/my-test-app',
        windowTypes: ['app', 'webview'],
      },
      'wdio:electronServiceOptions': {},
    });
  });

  it('should set the expected capabilities when the detected app path exists for an electron-builder dependency', async () => {
    delete options.appBinaryPath;
    (getBinaryPath as Mock).mockResolvedValueOnce('workspace/my-test-app/dist/my-test-app');
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
        rootDir: getFixtureDir('builder-dependency-inline-config'),
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
      'browserName': 'chrome',
      'browserVersion': '116.0.5845.190',
      'goog:chromeOptions': {
        args: [],
        binary: 'workspace/my-test-app/dist/my-test-app',
        windowTypes: ['app', 'webview'],
      },
      'wdio:electronServiceOptions': {},
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
        rootDir: getFixtureDir('no-build-tool'),
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
      'browserName': 'chrome',
      'browserVersion': '116.0.5845.190',
      'goog:chromeOptions': {
        args: ['--app=path/to/main.bundle.js'],
        binary: path.join(getFixtureDir('no-build-tool'), 'node_modules', '.bin', 'electron'),
        windowTypes: ['app', 'webview'],
      },
      'wdio:electronServiceOptions': {},
    });
  });

  it('should set the expected capabilities when setting custom chromedriverOptions', async () => {
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
        rootDir: getFixtureDir('no-electron'),
      } as Options.Testrunner,
    );
    const capabilities: WebdriverIO.Capabilities[] = [
      {
        'browserName': 'electron',
        'wdio:chromedriverOptions': {
          binary: '/path/to/chromedriver',
        },
      },
    ];
    await instance?.onPrepare({} as never, capabilities);
    expect(capabilities[0]).toEqual({
      'browserName': 'chrome',
      'goog:chromeOptions': {
        args: [],
        binary: 'workspace/my-test-app/dist/my-test-app',
        windowTypes: ['app', 'webview'],
      },
      'wdio:chromedriverOptions': {
        binary: '/path/to/chromedriver',
      },
      'wdio:electronServiceOptions': {},
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
        'browserName': 'chrome',
        'browserVersion': '116.0.5845.190',
        'goog:chromeOptions': {
          args: [],
          binary: 'workspace/my-test-app/dist/my-test-app',
          windowTypes: ['app', 'webview'],
        },
        'wdio:electronServiceOptions': {},
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
          browserVersion: '26.2.2',
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
            browserVersion: '25.0.0',
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
          'browserName': 'chrome',
          'browserVersion': '116.0.5845.190',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/my-test-app',
            windowTypes: ['app', 'webview'],
          },
          'wdio:electronServiceOptions': {},
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
            'browserName': 'chrome',
            'browserVersion': '114.0.5735.45',
            'goog:chromeOptions': {
              args: [],
              binary: 'workspace/my-test-app/dist/my-test-app',
              windowTypes: ['app', 'webview'],
            },
            'wdio:electronServiceOptions': {},
          },
        },
      },
    });
  });

  it('should set the expected capabilities when parallel multiremote', async () => {
    const capabilities: Capabilities.MultiRemoteCapabilities[] = [
      {
        firefox: {
          capabilities: {
            browserName: 'firefox',
          },
        },
        myElectronProject: {
          capabilities: {
            browserName: 'electron',
            browserVersion: '26.2.2',
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
              browserVersion: '25.0.0',
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
            'browserName': 'chrome',
            'browserVersion': '116.0.5845.190',
            'goog:chromeOptions': {
              args: [],
              binary: 'workspace/my-test-app/dist/my-test-app',
              windowTypes: ['app', 'webview'],
            },
            'wdio:electronServiceOptions': {},
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
              'browserName': 'chrome',
              'browserVersion': '114.0.5735.45',
              'goog:chromeOptions': {
                args: [],
                binary: 'workspace/my-test-app/dist/my-test-app',
                windowTypes: ['app', 'webview'],
              },
              'wdio:electronServiceOptions': {},
            },
          },
        },
      },
    ]);
  });
});
