import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { Capabilities, Options } from '@wdio/types';

import ElectronWorkerService from '../src/service';
import ElectronLaunchService from '../src/launcher';
import { mockProcessProperty, revertProcessProperty } from './helpers';
import type { BrowserExtension, ElectronServiceOptions } from '../src/index';

interface CustomBrowserExtension extends BrowserExtension {
  electron: BrowserExtension['electron'] & {
    customApi?: (...arg: unknown[]) => Promise<unknown>;
  };
}

let WorkerService: typeof ElectronWorkerService;
let LaunchService: typeof ElectronLaunchService;
let instance: ElectronWorkerService | ElectronLaunchService | undefined;

describe('options validation', () => {
  beforeEach(async () => {
    mockProcessProperty('platform', 'darwin');
    WorkerService = (await import('../src/service')).default;
  });

  it('should throw an error when there is a custom API command collision', () => {
    expect(() => {
      new WorkerService(
        {
          binaryPath: '/mock/dist',
          customApiBrowserCommand: 'app',
        },
        {} as never,
        {} as Options.Testrunner,
      );
    }).toThrow('The command "app" is reserved, please provide a different value for customApiBrowserCommand');
  });
});

describe('launcher', () => {
  afterEach(() => {
    instance = undefined;
    revertProcessProperty('platform');
  });

  describe('providing appBinary', () => {
    beforeEach(async () => {
      mockProcessProperty('platform', 'darwin');
      LaunchService = (await import('../src/launcher')).default;
    });

    it('should set the expected capabilities', async () => {
      const options: ElectronServiceOptions = {
        binaryPath: 'workspace/my-test-app/dist/my-test-app',
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
        binaryPath: 'workspace/my-test-app/dist/my-test-app',
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
  });

  describe('providing appArgs', () => {
    beforeEach(async () => {
      mockProcessProperty('platform', 'darwin');
      LaunchService = (await import('../src/launcher')).default;
    });

    it('should set the expected capabilities', async () => {
      const options: ElectronServiceOptions = {
        binaryPath: 'workspace/my-test-app/dist/my-test-app',
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
      expect(capabilities).toEqual([{
        'browserName': 'chrome',
        'goog:chromeOptions': {
          args: ['look', 'some', 'args'],
          binary: 'workspace/my-test-app/dist/my-test-app',
          windowTypes: ['app', 'webview'],
        },
      }]);
    });

    it('should set the expected capabilities when multiremote', async () => {
      const serviceOptions = {
        'wdio:electronServiceOptions': {
          binaryPath: 'workspace/my-test-app/dist/my-test-app',
          appArgs: ['look', 'some', 'args'],
        }
      }
      instance = new LaunchService(
        {
          binaryPath: 'workspace/my-test-app/dist/my-test-app',
          appArgs: ['look', 'some', 'args'],
        },
        {} as never,
        {} as Options.Testrunner,
      );
      const capabilities = {
        firefox: {
          capabilities: {
            'browserName': 'firefox',
            ...serviceOptions,
          },
        },
        myElectronProject: {
          capabilities: {
            'browserName': 'electron',
            'wdio:electronServiceOptions': {
              binaryPath: 'workspace/my-test-app/dist/my-test-app',
              appArgs: ['look', 'some', 'args'],
            },
          },
        },
        chrome: {
          capabilities: {
            'browserName': 'chrome',
            'wdio:electronServiceOptions': {
              binaryPath: 'workspace/my-test-app/dist/my-test-app',
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

  describe('providing appPath & appName', () => {
    describe('on MacOS platforms', () => {
      beforeEach(async () => {
        mockProcessProperty('platform', 'darwin');
        mockProcessProperty('arch', 'arm64');
        LaunchService = (await import('../src/launcher')).default;
      });

      it('should set the expected capabilities', async () => {
        instance = new LaunchService(
          {
            appPath: 'workspace/my-test-app/dist',
            appName: 'my-test-app',
          },
          {} as never,
          {} as Options.Testrunner,
        );
        const capabilities: Capabilities.Capabilities[] = [{ browserName: 'electron' }];
        await instance.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          'browserName': 'chrome',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/mac-arm64/my-test-app.app/Contents/MacOS/my-test-app',
            windowTypes: ['app', 'webview'],
          },
        });
      });

      it('should set the expected capabilities when the appName ends with "Helper"', async () => {
        instance = new LaunchService(
          {
            appPath: 'workspace/my-test-app/dist',
            appName: 'my-test-app',
          },
          {} as never,
          {} as Options.Testrunner,
        );
        const capabilities: Capabilities.Capabilities[] = [{ browserName: 'electron' }];
        await instance.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          'browserName': 'chrome',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/mac-arm64/my-test-app.app/Contents/MacOS/my-test-app',
            windowTypes: ['app', 'webview'],
          },
        });
      });

      it('should set the expected capabilities when multiremote', async () => {
        instance = new LaunchService(
          {
            appPath: 'workspace/my-test-app/dist',
            appName: 'my-test-app',
          },
          {} as never,
          {} as Options.Testrunner,
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
        await instance.onPrepare({} as never, capabilities);
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
                binary: 'workspace/my-test-app/dist/mac-arm64/my-test-app.app/Contents/MacOS/my-test-app',
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

      it('should set the expected capabilities when w3c specific', async () => {
        instance = new LaunchService(
          {
            appPath: 'workspace/my-test-app/dist',
            appName: 'my-test-app',
          },
          {} as never,
          {} as Options.Testrunner,
        );
        const capabilities: Capabilities.W3CCapabilities[] = [
          {
            alwaysMatch: {
              browserName: 'electron',
            },
            firstMatch: [],
          },
        ];
        await instance.onPrepare({} as never, capabilities);
        expect(capabilities[0]).toEqual({
          alwaysMatch: {
            'browserName': 'chrome',
            'goog:chromeOptions': {
              args: [],
              binary: 'workspace/my-test-app/dist/mac-arm64/my-test-app.app/Contents/MacOS/my-test-app',
              windowTypes: ['app', 'webview'],
            },
          },
          firstMatch: []
        });
      });

      it('should set the expected capabilities when parallel multiremote', async () => {
        instance = new LaunchService(
          {
            appPath: 'workspace/my-test-app/dist',
            appName: 'my-test-app',
          },
          {} as never,
          {} as Options.Testrunner,
        );
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
            chrome: {
              capabilities: {
                browserName: 'chrome',
              },
            },
          },
          {
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
          },
        ];
        await instance.onPrepare({} as never, capabilities);
        expect(capabilities).toEqual([
          {
            chrome: {
              capabilities: {
                browserName: 'chrome',
              },
            },
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
                  binary: 'workspace/my-test-app/dist/mac-arm64/my-test-app.app/Contents/MacOS/my-test-app',
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
            myElectronProject: {
              capabilities: {
                'browserName': 'chrome',
                'goog:chromeOptions': {
                  args: [],
                  binary: 'workspace/my-test-app/dist/mac-arm64/my-test-app.app/Contents/MacOS/my-test-app',
                  windowTypes: ['app', 'webview'],
                },
              },
            },
          },
        ]);

        describe('on Linux platforms', () => {
          beforeEach(async () => {
            mockProcessProperty('platform', 'linux');
            LaunchService = (await import('../src/launcher')).default;
          });

          it('should set the expected capabilities', async () => {
            instance = new LaunchService(
              {
                appPath: 'workspace/my-test-app/dist',
                appName: 'my-test-app',
              },
              {} as never,
              {} as Options.Testrunner,
            );
            const capabilities: Capabilities.Capabilities[] = [{ browserName: 'electron' }];
            await instance.onPrepare({} as never, capabilities);
            expect(capabilities).toEqual({
              'browserName': 'chrome',
              'goog:chromeOptions': {
                args: [],
                binary: 'workspace/my-test-app/dist/linux-unpacked/my-test-app',
                windowTypes: ['app', 'webview'],
              },
            });
          });
        });

        describe('on Windows platforms', () => {
          beforeEach(async () => {
            mockProcessProperty('platform', 'win32');
            LaunchService = (await import('../src/launcher')).default;
          });

          it('should set the expected capabilities', async () => {
            instance = new LaunchService(
              {
                appPath: 'workspace/my-test-app/dist',
                appName: 'my-test-app',
              },
              {} as never,
              {} as Options.Testrunner,
            );
            const capabilities: Capabilities.Capabilities[] = [{ browserName: 'electron' }]
            await instance.onPrepare({} as never, capabilities);
            expect(capabilities).toEqual({
              'browserName': 'chrome',
              'goog:chromeOptions': {
                args: [],
                binary: 'workspace/my-test-app/dist/win-unpacked/my-test-app.exe',
                windowTypes: ['app', 'webview'],
              },
            });
          });
        });

        describe('on unsupported platforms', () => {
          beforeEach(async () => {
            mockProcessProperty('platform', 'unsupported');
            LaunchService = (await import('../src/launcher')).default;
          });

          it('should throw an error', async () => {
            instance = new LaunchService(
              {
                appPath: 'workspace/my-test-app/dist',
                appName: 'my-test-app',
              },
              {} as never,
              {} as Options.Testrunner,
            );
            await expect(
              instance.onPrepare(
                {} as never,
                [{
                  browserName: 'electron',
                }],
              ),
            ).rejects.toThrow('Unsupported platform: unsupported');
          });
        });
      });
    });

    describe('before', () => {
      const addCommandMock = vi.fn();

      beforeEach(async () => {
        mockProcessProperty('platform', 'darwin');
        WorkerService = (await import('../src/service')).default;
      });

      it('should add API commands to the browser object', () => {
        instance = new WorkerService(
          {
            appPath: 'workspace/my-test-app/dist',
            appName: 'my-test-app',
            customApiBrowserCommand: 'customApi',
          },
          {} as never,
          {} as Options.Testrunner,
        );
        const browser = {
          addCommand: addCommandMock,
        } as unknown as WebdriverIO.Browser;
        instance.before({}, [], browser);
        const electronApi = browser.electron as CustomBrowserExtension['electron'];
        expect(electronApi.app).toEqual(expect.any(Function));
        expect(electronApi.browserWindow).toEqual(expect.any(Function));
        expect(electronApi.customApi).toEqual(expect.any(Function));
        expect(electronApi.dialog).toEqual(expect.any(Function));
        expect(electronApi.mainProcess).toEqual(expect.any(Function));
        expect(electronApi.mock).toEqual(expect.any(Function));
      });
    });
  });
});
