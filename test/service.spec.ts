import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { Capabilities } from '@wdio/types';
import ciInfo from 'ci-info';
import { Browser } from 'webdriverio';
import ElectronWorkerService from '../src/service';
import { mockProcessProperty, revertProcessProperty } from './helpers';

let WorkerService: typeof ElectronWorkerService;
let instance: ElectronWorkerService | undefined;

function mockIsCI(isCI: boolean) {
  Object.defineProperty(ciInfo, 'isCI', { get: () => isCI });
}

vi.mock('ci-info', async () => {
  const actual: typeof ciInfo = await vi.importActual('ci-info');
  return {
    ...actual,
    isCI: false,
  };
});

describe('options validation', () => {
  beforeEach(async () => {
    mockProcessProperty('platform', 'darwin');
    WorkerService = (await import('../src/service')).default;
  });

  it('should throw an error when no path options are specified', () => {
    expect(() => {
      instance = new WorkerService({});
    }).toThrow('You must provide appPath and appName values, or a binaryPath value');
  });

  it('should throw an error when appName is specified without appPath', () => {
    expect(() => {
      instance = new WorkerService({
        appName: 'mock-app',
      });
    }).toThrow('You must provide appPath and appName values, or a binaryPath value');
  });

  it('should throw an error when appPath is specified without appName', () => {
    expect(() => {
      instance = new WorkerService({
        appPath: '/mock/dist',
      });
    }).toThrow('You must provide appPath and appName values, or a binaryPath value');
  });

  it('should throw an error when there is a custom API command collision', () => {
    expect(() => {
      instance = new WorkerService({
        binaryPath: '/mock/dist',
        customApiBrowserCommand: 'app',
      });
    }).toThrow('The command "app" is reserved, please provide a different value for customApiBrowserCommand');
  });
});

describe('beforeSession', () => {
  afterEach(() => {
    instance = undefined;
    mockIsCI(false);
    revertProcessProperty('platform');
  });

  describe('providing appBinary', () => {
    beforeEach(async () => {
      mockProcessProperty('platform', 'darwin');
      WorkerService = (await import('../src/service')).default;
    });

    it('should set the expected capabilities', () => {
      instance = new WorkerService({
        binaryPath: 'workspace/my-test-app/dist/my-test-app',
      });
      const capabilities = {};
      instance.beforeSession({}, capabilities);
      expect(capabilities).toEqual({
        'browserName': 'chrome',
        'goog:chromeOptions': {
          args: [],
          binary: 'workspace/my-test-app/dist/my-test-app',
          windowTypes: ['app', 'webview'],
        },
      });
    });

    it('should set the expected capabilities when multiremote', () => {
      instance = new WorkerService({
        binaryPath: 'workspace/my-test-app/dist/my-test-app',
      });
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
      instance.beforeSession({}, capabilities as Capabilities.Capabilities);
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
      WorkerService = (await import('../src/service')).default;
    });

    it('should set the expected capabilities', () => {
      instance = new WorkerService({
        binaryPath: 'workspace/my-test-app/dist/my-test-app',
        appArgs: ['look', 'some', 'args'],
      });
      const capabilities = {};
      instance.beforeSession({}, capabilities);
      expect(capabilities).toEqual({
        'browserName': 'chrome',
        'goog:chromeOptions': {
          args: ['look', 'some', 'args'],
          binary: 'workspace/my-test-app/dist/my-test-app',
          windowTypes: ['app', 'webview'],
        },
      });
    });

    it('should set the expected capabilities when multiremote', () => {
      instance = new WorkerService({
        binaryPath: 'workspace/my-test-app/dist/my-test-app',
        appArgs: ['look', 'some', 'args'],
      });
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
      instance.beforeSession({}, capabilities as Capabilities.Capabilities);
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

  describe('providing appArgs running on CI', () => {
    beforeEach(async () => {
      mockProcessProperty('platform', 'darwin');
      mockProcessProperty('arch', 'arm64');
      mockIsCI(true);
      WorkerService = (await import('../src/service')).default;
    });

    it('should set the expected capabilities', () => {
      instance = new WorkerService({
        appPath: 'workspace/my-test-app/dist',
        appName: 'my-test-app',
        appArgs: ['look', 'some', 'args'],
      });
      const capabilities = {};
      instance.beforeSession({}, capabilities);
      expect(capabilities).toEqual({
        'browserName': 'chrome',
        'goog:chromeOptions': {
          args: [
            'window-size=1280,800',
            'blink-settings=imagesEnabled=false',
            'enable-automation',
            'disable-infobars',
            'disable-extensions',
            'no-sandbox',
            'disable-gpu',
            'disable-dev-shm-usage',
            'disable-setuid-sandbox',
            'look',
            'some',
            'args',
          ],
          binary: 'workspace/my-test-app/dist/mac-arm64/my-test-app.app/Contents/MacOS/my-test-app',
          windowTypes: ['app', 'webview'],
        },
      });
    });

    it('should set the expected capabilities when multiremote', () => {
      instance = new WorkerService({
        appPath: 'workspace/my-test-app/dist',
        appName: 'my-test-app',
        appArgs: ['look', 'some', 'args'],
      });
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
      instance.beforeSession({}, capabilities as Capabilities.Capabilities);
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
              args: [
                'window-size=1280,800',
                'blink-settings=imagesEnabled=false',
                'enable-automation',
                'disable-infobars',
                'disable-extensions',
                'no-sandbox',
                'disable-gpu',
                'disable-dev-shm-usage',
                'disable-setuid-sandbox',
                'look',
                'some',
                'args',
              ],
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

  describe('providing appPath & appName', () => {
    describe('on MacOS platforms', () => {
      beforeEach(async () => {
        mockProcessProperty('platform', 'darwin');
        mockProcessProperty('arch', 'arm64');
        WorkerService = (await import('../src/service')).default;
      });

      it('should set the expected capabilities', () => {
        instance = new WorkerService({
          appPath: 'workspace/my-test-app/dist',
          appName: 'my-test-app',
        });
        const capabilities = {};
        instance.beforeSession({}, capabilities);
        expect(capabilities).toEqual({
          'browserName': 'chrome',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/mac-arm64/my-test-app.app/Contents/MacOS/my-test-app',
            windowTypes: ['app', 'webview'],
          },
        });
      });

      it('should set the expected capabilities when the appName ends with "Helper"', () => {
        instance = new WorkerService({
          appPath: 'workspace/my-test-app/dist',
          appName: 'My Test Helper',
        });
        const capabilities = {};
        instance.beforeSession({}, capabilities);
        expect(capabilities).toEqual({
          'browserName': 'chrome',
          'goog:chromeOptions': {
            args: [],
            binary: 'workspace/my-test-app/dist/mac-arm64/My Test Helper.app/Contents/MacOS/My Test',
            windowTypes: ['app', 'webview'],
          },
        });
      });

      it('should set the expected capabilities when multiremote', () => {
        instance = new WorkerService({
          appPath: 'workspace/my-test-app/dist',
          appName: 'my-test-app',
        });
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
        instance.beforeSession({}, capabilities as Capabilities.Capabilities);
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

    describe('on MacOS platforms running on CI', () => {
      beforeEach(async () => {
        mockProcessProperty('platform', 'darwin');
        mockProcessProperty('arch', 'arm64');
        mockIsCI(true);
        WorkerService = (await import('../src/service')).default;
      });

      it('should set the expected capabilities', () => {
        instance = new WorkerService({
          appPath: 'workspace/my-test-app/dist',
          appName: 'my-test-app',
        });
        const capabilities = {};
        instance.beforeSession({}, capabilities);
        expect(capabilities).toEqual({
          'browserName': 'chrome',
          'goog:chromeOptions': {
            args: [
              'window-size=1280,800',
              'blink-settings=imagesEnabled=false',
              'enable-automation',
              'disable-infobars',
              'disable-extensions',
              'no-sandbox',
              'disable-gpu',
              'disable-dev-shm-usage',
              'disable-setuid-sandbox',
            ],
            binary: 'workspace/my-test-app/dist/mac-arm64/my-test-app.app/Contents/MacOS/my-test-app',
            windowTypes: ['app', 'webview'],
          },
        });
      });
    });

    describe('on Linux platforms', () => {
      beforeEach(async () => {
        mockProcessProperty('platform', 'linux');
        WorkerService = (await import('../src/service')).default;
      });

      it('should set the expected capabilities', () => {
        instance = new WorkerService({
          appPath: 'workspace/my-test-app/dist',
          appName: 'my-test-app',
        });
        const capabilities = {};
        instance.beforeSession({}, capabilities);
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

    describe('on Linux platforms running on CI', () => {
      beforeEach(async () => {
        mockProcessProperty('platform', 'linux');
        mockIsCI(true);
        WorkerService = (await import('../src/service')).default;
      });

      it('should set the expected capabilities', () => {
        instance = new WorkerService({
          appPath: 'workspace/my-test-app/dist',
          appName: 'my-test-app',
        });
        const capabilities = {};
        instance.beforeSession({}, capabilities);
        expect(capabilities).toEqual({
          'browserName': 'chrome',
          'goog:chromeOptions': {
            args: [
              'window-size=1280,800',
              'blink-settings=imagesEnabled=false',
              'enable-automation',
              'disable-infobars',
              'disable-extensions',
              'no-sandbox',
              'disable-gpu',
              'disable-dev-shm-usage',
              'disable-setuid-sandbox',
            ],
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

      it('should set the expected capabilities', () => {
        instance = new WorkerService({
          appPath: 'workspace/my-test-app/dist',
          appName: 'my-test-app',
        });
        const capabilities = {};
        instance.beforeSession({}, capabilities);
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

    describe('on Windows platforms running on CI', () => {
      beforeEach(async () => {
        mockProcessProperty('platform', 'win32');
        mockIsCI(true);
        WorkerService = (await import('../src/service')).default;
      });

      it('should set the expected capabilities', () => {
        instance = new WorkerService({
          appPath: 'workspace/my-test-app/dist',
          appName: 'my-test-app',
        });
        const capabilities = {};
        instance.beforeSession({}, capabilities);
        expect(capabilities).toEqual({
          'browserName': 'chrome',
          'goog:chromeOptions': {
            args: [
              'window-size=1280,800',
              'blink-settings=imagesEnabled=false',
              'enable-automation',
              'disable-infobars',
              'disable-extensions',
            ],
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

      it('should throw an error', () => {
        instance = new WorkerService({
          appPath: 'workspace/my-test-app/dist',
          appName: 'my-test-app',
        });
        expect(() => {
          (instance as ElectronWorkerService).beforeSession({}, {});
        }).toThrow('Unsupported platform: unsupported');
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
    });
    instance.before({}, [], {
      addCommand: addCommandMock,
    } as unknown as Browser);
    expect(addCommandMock.mock.calls).toEqual([
      ['customApi', expect.any(Function)],
      ['app', expect.any(Function)],
      ['mainProcess', expect.any(Function)],
      ['browserWindow', expect.any(Function)],
    ]);
  });
});
