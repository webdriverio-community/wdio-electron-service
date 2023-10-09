import path from 'node:path';
import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { Capabilities, Options } from '@wdio/types';

import ElectronLaunchService from '../src/launcher';
import { mockProcessProperty, revertProcessProperty } from './helpers';
import type { ElectronServiceOptions } from '../src/index';

let LaunchService: typeof ElectronLaunchService;
let instance: ElectronLaunchService | undefined;
let options: ElectronServiceOptions;

beforeEach(async () => {
  mockProcessProperty('platform', 'darwin');
  LaunchService = (await import('../src/launcher')).default;
  options = {
    appBinaryPath: 'workspace/my-test-app/dist/my-test-app',
  };
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
    const capabilities: Capabilities.Capabilities[] = [
      {
        browserName: 'chrome',
        browserVersion: '26.2.2',
      },
    ];
    await expect(() => instance?.onPrepare({} as never, capabilities)).rejects.toThrow(
      'No Electron browser found in capabilities',
    );
  });

  it('should throw an error when there is no appBinaryPath for a given electron capability', async () => {
    delete options.appBinaryPath;
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
      } as Options.Testrunner,
    );
    const capabilities: WebDriver.Capabilities[] = [
      {
        'browserName': 'electron',
        'browserVersion': '26.2.2',
        'wdio:electronServiceOptions': {
          appArgs: ['some', 'args'],
        },
      },
    ];
    await expect(() => instance?.onPrepare({} as never, capabilities)).rejects.toThrow(
      'Failed setting up Electron session: Error: You must provide the appBinaryPath value for all Electron capabilities',
    );
  });

  it('should override global options with capabilities', async () => {
    const capabilities: WebDriver.Capabilities[] = [
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
    const capabilities: Capabilities.Capabilities[] = [
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
    });
  });

  it('should use the Electron version from the local package dependencies when browserVersion is not provided', async () => {
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
        rootDir: path.join(process.cwd(), 'test', 'fixtures', 'electron-in-dependencies'),
      } as Options.Testrunner,
    );
    const capabilities: Capabilities.Capabilities[] = [
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
    });
  });

  it('should use the Electron version from the nearest package dependencies when browserVersion is not provided', async () => {
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
        rootDir: path.join(process.cwd(), 'test', 'fixtures', 'electron-in-dependencies', 'subpackage', 'subdir'),
      } as Options.Testrunner,
    );
    const capabilities: Capabilities.Capabilities[] = [
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
    });
  });

  it('should use the Electron version from the local package devDependencies when browserVersion is not provided', async () => {
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
        rootDir: path.join(process.cwd(), 'test', 'fixtures', 'electron-in-dev-dependencies'),
      } as Options.Testrunner,
    );
    const capabilities: Capabilities.Capabilities[] = [
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
    });
  });

  it('should use the Electron version from the nearest package devDependencies when browserVersion is not provided', async () => {
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
        rootDir: path.join(process.cwd(), 'test', 'fixtures', 'electron-in-dev-dependencies', 'subpackage', 'subdir'),
      } as Options.Testrunner,
    );
    const capabilities: Capabilities.Capabilities[] = [
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
    });
  });

  it('should throw an error when browserVersion is not provided and there is no local Electron version', async () => {
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
        rootDir: path.join(process.cwd(), 'test', 'fixtures', 'no-electron'),
      } as Options.Testrunner,
    );
    const capabilities: Capabilities.Capabilities[] = [
      {
        browserName: 'electron',
      },
    ];
    await expect(() => instance?.onPrepare({} as never, capabilities)).rejects.toThrow(
      'Failed setting up Electron session: Error: You must install Electron locally, or provide a custom Chromedriver path / browserVersion value for each Electron capability',
    );
  });

  it('should set the expected capabilities', async () => {
    const capabilities: Capabilities.Capabilities[] = [
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
    });
  });

  it('should set the expected capabilities when setting custom chromedriverOptions', async () => {
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
        rootDir: path.join(process.cwd(), 'test', 'fixtures', 'no-electron'),
      } as Options.Testrunner,
    );
    const capabilities: Capabilities.Capabilities[] = [
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
            },
          },
        },
      },
    ]);
  });
});
