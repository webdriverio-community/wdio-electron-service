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
        'wdio:electronServiceOptions': {
          appBinaryPath: 'workspace/my-other-test-app/dist/my-other-test-app',
        },
      },
    ];
    await instance?.onPrepare({} as never, capabilities);
    expect(capabilities[0]).toEqual({
      'browserName': 'chrome',
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
        },
      },
    ];
    await instance?.onPrepare({} as never, capabilities);
    expect(capabilities[0]).toEqual({
      firstMatch: [],
      alwaysMatch: {
        'browserName': 'chrome',
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
