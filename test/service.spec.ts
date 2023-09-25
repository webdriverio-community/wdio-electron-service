import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { Capabilities } from '@wdio/types';

import { BrowserExtension } from '../src/index';
import ElectronWorkerService from '../src/service';
import { mockProcessProperty, revertProcessProperty } from './helpers';

interface CustomBrowserExtension extends BrowserExtension {
  electron: BrowserExtension['electron'] & {
    customApi?: (...arg: unknown[]) => Promise<unknown>;
  };
}

let WorkerService: typeof ElectronWorkerService;
let instance: ElectronWorkerService | undefined;

describe('options validation', () => {
  beforeEach(async () => {
    mockProcessProperty('platform', 'darwin');
    WorkerService = (await import('../src/service')).default;
  });

  it('should throw an error when there is a custom API command collision', () => {
    expect(() => {
      new WorkerService({
        binaryPath: '/mock/dist',
        customApiBrowserCommand: 'app',
      }, {} as never, {} as any);
    }).toThrow('The command "app" is reserved, please provide a different value for customApiBrowserCommand');
  });
});

describe('beforeSession', () => {
  afterEach(() => {
    instance = undefined;
    revertProcessProperty('platform');
  });

  describe('providing appBinary', () => {
    beforeEach(async () => {
      mockProcessProperty('platform', 'darwin');
      WorkerService = (await import('../src/service')).default;
    });

    it('should set the expected capabilities', async () => {
      instance = new WorkerService({
        binaryPath: 'workspace/my-test-app/dist/my-test-app',
      }, {} as never, {} as any)
      const capabilities: Capabilities.Capabilities = {
        browserName: 'electron'
      }
      await instance.beforeSession({}, capabilities);
      expect(capabilities).toEqual({
        'browserName': 'chrome',
        'goog:chromeOptions': {
          args: [],
          binary: 'workspace/my-test-app/dist/my-test-app',
          windowTypes: ['app', 'webview'],
        }
      })
    })

    it('should set the expected capabilities when multiremote', async () => {
      instance = new WorkerService({
        binaryPath: 'workspace/my-test-app/dist/my-test-app'
      }, {} as never, {} as any)
      const capabilities = {
        firefox: {
          capabilities: {
            browserName: 'firefox',
          }
        },
        myElectronProject: {
          capabilities: {
            browserName: 'electron',
          }
        },
        chrome: {
          capabilities: {
            browserName: 'chrome'
          }
        }
      }
      await instance.beforeSession({}, capabilities as Capabilities.Capabilities);
      expect(capabilities).toEqual({
        firefox: {
          capabilities: {
            browserName: 'firefox'
          }
        },
        myElectronProject: {
          capabilities: {
            'browserName': 'chrome',
            'goog:chromeOptions': {
              args: [],
              binary: 'workspace/my-test-app/dist/my-test-app',
              windowTypes: ['app', 'webview']
            }
          }
        },
        chrome: {
          capabilities: {
            browserName: 'chrome',
          }
        }
      })
    })
  })

  describe('providing appArgs', () => {
    beforeEach(async () => {
      mockProcessProperty('platform', 'darwin');
      WorkerService = (await import('../src/service')).default;
    });

    it('should set the expected capabilities', async () => {
      instance = new WorkerService({
        binaryPath: 'workspace/my-test-app/dist/my-test-app',
        appArgs: ['look', 'some', 'args'],
      }, {} as never, {} as any);
      const capabilities: Capabilities.Capabilities = {
        browserName: 'electron'
      };
      await instance.beforeSession({}, capabilities);
      expect(capabilities).toEqual({
        'browserName': 'chrome',
        'goog:chromeOptions': {
          args: ['look', 'some', 'args'],
          binary: 'workspace/my-test-app/dist/my-test-app',
          windowTypes: ['app', 'webview'],
        },
      });
    });

    it('should set the expected capabilities when multiremote', async () => {
      instance = new WorkerService({
        binaryPath: 'workspace/my-test-app/dist/my-test-app',
        appArgs: ['look', 'some', 'args'],
      }, {} as never, {} as any);
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
      await instance.beforeSession({}, capabilities as Capabilities.Capabilities);
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
              args: ['look', 'some', 'args'],
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

  describe('providing appPath & appName', () => {
    describe('on MacOS platforms', () => {
      beforeEach(async () => {
        mockProcessProperty('platform', 'darwin');
        mockProcessProperty('arch', 'arm64');
        WorkerService = (await import('../src/service')).default;
      });

      it('should set the expected capabilities', async () => {
        instance = new WorkerService({
          appPath: 'workspace/my-test-app/dist',
          appName: 'my-test-app',
        }, {} as never, {} as any);
        const capabilities: Capabilities.Capabilities = { browserName: 'electron' }
        await instance.beforeSession({}, capabilities);
        expect(capabilities).toEqual({
          'browserName': 'chrome',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/mac-arm64/my-test-app.app/Contents/MacOS/my-test-app',
            windowTypes: ['app', 'webview'],
          },
        });
      });

      it('should set the expected capabilities when the appName ends with "Helper"', async () => {
        instance = new WorkerService({
          appPath: 'workspace/my-test-app/dist',
          appName: 'My Test Helper',
        }, {} as never, {} as any);
        const capabilities: Capabilities.Capabilities = { browserName: 'electron' }
        await instance.beforeSession({}, capabilities);
        expect(capabilities).toEqual({
          'browserName': 'chrome',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/mac-arm64/My Test Helper.app/Contents/MacOS/My Test',
            windowTypes: ['app', 'webview'],
          },
        });
      });

      it('should set the expected capabilities when multiremote', async () => {
        instance = new WorkerService({
          appPath: 'workspace/my-test-app/dist',
          appName: 'my-test-app',
        }, {} as never, {} as any);
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
        await instance.beforeSession({}, capabilities as Capabilities.Capabilities);
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
    });

    describe('on Linux platforms', () => {
      beforeEach(async () => {
        mockProcessProperty('platform', 'linux');
        WorkerService = (await import('../src/service')).default;
      });

      it('should set the expected capabilities', async () => {
        instance = new WorkerService({
          appPath: 'workspace/my-test-app/dist',
          appName: 'my-test-app',
        }, {} as never, {} as any);
        const capabilities: Capabilities.Capabilities = { browserName: 'electron' }
        await instance.beforeSession({}, capabilities);
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
        WorkerService = (await import('../src/service')).default;
      });

      it('should set the expected capabilities', async () => {
        instance = new WorkerService({
          appPath: 'workspace/my-test-app/dist',
          appName: 'my-test-app',
        }, {} as never, {} as any);
        const capabilities: Capabilities.Capabilities = { browserName: 'electron' }
        await instance.beforeSession({}, capabilities);
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
        WorkerService = (await import('../src/service')).default;
      });

      it('should throw an error', async () => {
        instance = new WorkerService({
          appPath: 'workspace/my-test-app/dist',
          appName: 'my-test-app',
        }, {} as never, {} as any);
        await expect((instance as ElectronWorkerService).beforeSession({}, {
          browserName: 'electron'
        })).rejects.toThrow('Unsupported platform: unsupported');
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
    instance = new WorkerService({
      appPath: 'workspace/my-test-app/dist',
      appName: 'my-test-app',
      customApiBrowserCommand: 'customApi',
    }, {} as never, {} as any);
    const browser = {
      addCommand: addCommandMock,
    } as unknown as WebdriverIO.Browser
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
