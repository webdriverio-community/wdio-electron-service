import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { Capabilities, Options } from '@wdio/types';

import ElectronLaunchService from '../src/launcher';
import { mockProcessProperty, revertProcessProperty } from './helpers';
import type { ElectronServiceOptions } from '../src/index';

let LaunchService: typeof ElectronLaunchService;
let instance: ElectronLaunchService | undefined;

describe('launcher', () => {
  beforeEach(async () => {
    mockProcessProperty('platform', 'darwin');
    LaunchService = (await import('../src/launcher')).default;
  });

  afterEach(() => {
    instance = undefined;
    revertProcessProperty('platform');
  });

  it('should set the expected capabilities', async () => {
    const options: ElectronServiceOptions = {
      appBinaryPath: 'workspace/my-test-app/dist/my-test-app',
    };
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
      } as any as Options.Testrunner,
    );
    const capabilities: Capabilities.Capabilities[] = [
      {
        browserName: 'electron',
      },
    ];
    await instance.onPrepare({} as never, capabilities);
    expect(capabilities[0]).toEqual({
      'browserName': 'chrome',
      'goog:chromeOptions': {
        args: [],
        binary: 'workspace/my-test-app/dist/my-test-app',
        windowTypes: ['app', 'webview'],
      },
    });
  });

  it('should set the expected capabilities when multiremote', async () => {
    const options: ElectronServiceOptions = {
      appBinaryPath: 'workspace/my-test-app/dist/my-test-app',
    };
    instance = new LaunchService(
      options,
      [] as never,
      {
        services: [['electron', options]],
      } as any as Options.Testrunner,
    );
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
    };
    await instance.onPrepare({} as never, capabilities as Capabilities.MultiRemoteCapabilities);
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
    });
  });

  describe('providing appArgs', () => {
    it('should set the expected capabilities', async () => {
      const options: ElectronServiceOptions = {
        appBinaryPath: 'workspace/my-test-app/dist/my-test-app',
        appArgs: ['look', 'some', 'args'],
      };
      instance = new LaunchService(
        options,
        [] as never,
        {
          services: [['electron', options]],
        } as any as Options.Testrunner,
      );
      const capabilities: Capabilities.Capabilities[] = [
        {
          browserName: 'electron',
        },
      ];
      await instance.onPrepare({} as never, capabilities);
      expect(capabilities).toEqual([
        {
          'browserName': 'chrome',
          'goog:chromeOptions': {
            args: ['look', 'some', 'args'],
            binary: 'workspace/my-test-app/dist/my-test-app',
            windowTypes: ['app', 'webview'],
          },
        },
      ]);
    });

    it('should set the expected capabilities when multiremote', async () => {
      const serviceOptions = {
        'wdio:electronServiceOptions': {
          appBinaryPath: 'workspace/my-test-app/dist/my-test-app',
          appArgs: ['look', 'some', 'args'],
        },
      };
      instance = new LaunchService(
        {
          appBinaryPath: 'workspace/my-test-app/dist/my-test-app',
          appArgs: ['look', 'some', 'args'],
        },
        {} as never,
        {} as Options.Testrunner,
      );
      const capabilities = {
        firefox: {
          capabilities: {
            browserName: 'firefox',
            ...serviceOptions,
          },
        },
        myElectronProject: {
          capabilities: {
            'browserName': 'electron',
            'wdio:electronServiceOptions': {
              appBinaryPath: 'workspace/my-test-app/dist/my-test-app',
              appArgs: ['look', 'some', 'args'],
            },
          },
        },
        chrome: {
          capabilities: {
            'browserName': 'chrome',
            'wdio:electronServiceOptions': {
              appBinaryPath: 'workspace/my-test-app/dist/my-test-app',
              appArgs: ['look', 'some', 'args'],
            },
          },
        },
      };
      await instance.onPrepare({} as never, capabilities as Capabilities.MultiRemoteCapabilities);
      expect(capabilities).toEqual({
        firefox: {
          capabilities: {
            ...serviceOptions,
            browserName: 'firefox',
          },
        },
        myElectronProject: {
          capabilities: {
            ...serviceOptions,
            'browserName': 'chrome',
            'goog:chromeOptions': {
              args: ['look', 'some', 'args'],
              binary: 'workspace/my-test-app/dist/my-test-app',
              windowTypes: ['app', 'webview'],
            },
          },
        },
        chrome: {
          capabilities: {
            ...serviceOptions,
            browserName: 'chrome',
          },
        },
      });
    });
  });
});
