/* eslint-disable node/no-unsupported-features/es-syntax */
// https://github.com/mysticatea/eslint-plugin-node/issues/250

import ciInfo from 'ci-info';
import ElectronWorkerService from '../src/service';

const originalPlatform = process.platform;
let WorkerService: typeof ElectronWorkerService;
let instance: ElectronWorkerService | undefined;

function mockProcessProperty(name: string, value: string) {
  Object.defineProperty(process, name, {
    value,
    configurable: true,
    writable: true,
  });
}

function mockIsCI(isCI: boolean) {
  Object.defineProperty(ciInfo, 'isCI', { get: () => isCI });
}

jest.mock('ci-info', () => ({ isCI: false }));

describe('beforeSession', () => {
  afterAll(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
  });

  afterEach(() => {
    instance = undefined;
    mockIsCI(false);
  });

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

describe('afterTest', () => {
  const reloadSessionMock = jest.fn();

  beforeEach(async () => {
    global.browser = {
      reloadSession: reloadSessionMock.mockResolvedValue('reloaded'),
    };
    // Object.defineProperty(global, 'browser', {
    //   value: {},
    //   configurable: true,
    //   writable: true,
    // });
    // browser.reloadSession = reloadSessionMock.mockResolvedValue('reloaded');
    mockProcessProperty('platform', 'darwin');
    WorkerService = (await import('../src/service')).default;
  });

  it('should reload the browser session', () => {
    instance = new WorkerService({
      appPath: 'workspace/my-test-app/dist',
      appName: 'my-test-app',
    });
    expect(reloadSessionMock).toHaveBeenCalled();
  });
});
