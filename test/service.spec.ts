import ciInfo from 'ci-info';
import { Browser } from 'webdriverio';
import ElectronWorkerService from '../src/service';
import { mockProcessProperty, revertProcessProperty } from './helpers';

let WorkerService: typeof ElectronWorkerService;
let instance: ElectronWorkerService | undefined;

function mockIsCI(isCI: boolean) {
  Object.defineProperty(ciInfo, 'isCI', { get: () => isCI });
}

jest.mock('ci-info', () => ({ isCI: false }));

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
        customApiBrowserCommand: 'electronApp',
      });
    }).toThrow('The command "electronApp" is reserved, please provide a different value for customApiBrowserCommand');
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
  });

  describe('providing appArgs running on CI', () => {
    beforeEach(async () => {
      mockProcessProperty('platform', 'darwin');
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
          binary: 'workspace/my-test-app/dist/mac/my-test-app.app/Contents/MacOS/my-test-app',
          windowTypes: ['app', 'webview'],
        },
      });
    });
  });

  describe('providing appPath & appName', () => {
    describe('on MacOS platforms', () => {
      beforeEach(async () => {
        mockProcessProperty('platform', 'darwin');
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
            binary: 'workspace/my-test-app/dist/mac/my-test-app.app/Contents/MacOS/my-test-app',
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
            binary: 'workspace/my-test-app/dist/mac/My Test Helper.app/Contents/MacOS/My Test',
            windowTypes: ['app', 'webview'],
          },
        });
      });
    });

    describe('on MacOS platforms running on CI', () => {
      beforeEach(async () => {
        mockProcessProperty('platform', 'darwin');
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
            binary: 'workspace/my-test-app/dist/mac/my-test-app.app/Contents/MacOS/my-test-app',
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
  const addCommandMock = jest.fn();

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
    } as unknown as Browser<'async'>);
    expect(addCommandMock.mock.calls).toEqual([
      ['customApi', expect.any(Function)],
      ['electronApp', expect.any(Function)],
      ['electronMainProcess', expect.any(Function)],
      ['electronBrowserWindow', expect.any(Function)],
    ]);
  });
});

describe('afterTest', () => {
  const reloadSessionMock = jest.fn();

  beforeEach(async () => {
    Object.defineProperty(global, 'browser', {
      value: { reloadSession: reloadSessionMock.mockResolvedValue('reloaded') },
    });
    mockProcessProperty('platform', 'darwin');
    WorkerService = (await import('../src/service')).default;
  });

  it('should reload the browser session', async () => {
    instance = new WorkerService({
      appPath: 'workspace/my-test-app/dist',
      appName: 'my-test-app',
    });
    await instance.afterTest();
    expect(reloadSessionMock).toHaveBeenCalled();
  });
});
