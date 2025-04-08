import { vi, describe, beforeEach, it, expect } from 'vitest';
import type { BrowserExtension } from '@wdio/electron-types';

import { mockProcessProperty } from './helpers.js';
import { execute } from '../src/commands/executeCdp.js';
import type ElectronWorkerService from '../src/service.js';
import { ElectronCdpBridge } from '../src/bridge.js';

vi.mock('../src/window.js');
vi.mock('../src/commands/executeCdp', () => {
  return {
    execute: vi.fn(),
  };
});

vi.mock('../src/bridge', () => {
  const ElectronCdpBridge = vi.fn();
  ElectronCdpBridge.prototype.connect = vi.fn();
  ElectronCdpBridge.prototype.send = vi.fn();
  ElectronCdpBridge.prototype.on = vi.fn();
  return {
    getDebuggerEndpoint: vi.fn(),
    ElectronCdpBridge,
  };
});

// TODO: Start: This section could be remove at V9
vi.mock('@wdio/electron-utils/log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

global.console.log = vi.fn();
// TODO: End: This section could be remove at V9

let WorkerService: typeof ElectronWorkerService;
let instance: ElectronWorkerService | undefined;

beforeEach(async () => {
  mockProcessProperty('platform', 'darwin');
  WorkerService = (await import('../src/service.js')).default;
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('Electron Worker Service', () => {
  describe('before()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should add electron commands to the browser object', async () => {
      instance = new WorkerService();

      const browser = {
        waitUntil: vi.fn().mockImplementation(async (condition) => {
          await condition();
        }),
        execute: vi.fn().mockImplementation((fn) => fn()),
        getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
        switchToWindow: vi.fn(),
        getPuppeteer: vi.fn(),
        electron: {}, // Let the service initialize this
      } as unknown as WebdriverIO.Browser;

      await instance.before({}, [], browser);

      const serviceApi = browser.electron as BrowserExtension['electron'];
      expect(serviceApi.clearAllMocks).toEqual(expect.any(Function));
      expect(serviceApi.execute).toEqual(expect.any(Function));
      expect(serviceApi.mock).toEqual(expect.any(Function));
      expect(serviceApi.mockAll).toEqual(expect.any(Function));
      expect(serviceApi.resetAllMocks).toEqual(expect.any(Function));
      expect(serviceApi.restoreAllMocks).toEqual(expect.any(Function));
    });
    it('should call contractor for the CDP Bridge with options', async () => {
      instance = new WorkerService({
        cdpConnectionRetryCount: 1,
        cdpConnectionTimeout: 100,
        cdpConnectionWaitInterval: 200,
      });

      const browser = {
        waitUntil: vi.fn().mockImplementation(async (condition) => {
          await condition();
        }),
        execute: vi.fn().mockImplementation((fn) => fn()),
        getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
        switchToWindow: vi.fn(),
        getPuppeteer: vi.fn(),
        electron: {}, // Let the service initialize this
      } as unknown as WebdriverIO.Browser;

      await instance.before({}, [], browser);
      expect(ElectronCdpBridge).toHaveBeenCalledWith({
        connectionRetryCount: 1,
        timeout: 100,
        waitInterval: 200,
      });
    });
    it('should call contractor for the CDP Bridge with no options', async () => {
      instance = new WorkerService();

      const browser = {
        waitUntil: vi.fn().mockImplementation(async (condition) => {
          await condition();
        }),
        execute: vi.fn().mockImplementation((fn) => fn()),
        getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
        switchToWindow: vi.fn(),
        getPuppeteer: vi.fn(),
        electron: {}, // Let the service initialize this
      } as unknown as WebdriverIO.Browser;

      await instance.before({}, [], browser);
      expect(ElectronCdpBridge).toHaveBeenCalledWith({});
    });

    describe('when multiremote', () => {
      it('should add electron commands to the browser object', async () => {
        instance = new WorkerService();
        const electronInstance = {
          requestedCapabilities: {
            alwaysMatch: {
              'browserName': 'electron',
              'wdio:electronServiceOptions': {},
            },
          },
          waitUntil: vi.fn().mockImplementation(async (condition) => {
            await condition();
          }),
          execute: vi.fn().mockResolvedValue(true),
          getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
          switchToWindow: vi.fn(),
          getPuppeteer: vi.fn(),
          electron: {}, // Let the service initialize this
        } as unknown as WebdriverIO.Browser;

        const browser = {
          instances: ['electron'],
          getInstance: (name: string) => (name === 'electron' ? electronInstance : undefined),
          execute: vi.fn().mockResolvedValue(true),
          isMultiremote: true,
        } as unknown as WebdriverIO.MultiRemoteBrowser;

        await instance.before({}, [], browser);

        // expect electron is set to root browser
        const rootServiceApi = browser.electron;
        expect(rootServiceApi.clearAllMocks).toEqual(expect.any(Function));
        expect(rootServiceApi.execute).toEqual(expect.any(Function));
        expect(rootServiceApi.mock).toEqual(expect.any(Function));
        expect(rootServiceApi.mockAll).toEqual(expect.any(Function));
        expect(rootServiceApi.resetAllMocks).toEqual(expect.any(Function));
        expect(rootServiceApi.restoreAllMocks).toEqual(expect.any(Function));

        // expect electron is set to electron browser
        const serviceApi = electronInstance.electron;
        expect(serviceApi.clearAllMocks).toEqual(expect.any(Function));
        expect(serviceApi.execute).toEqual(expect.any(Function));
        expect(serviceApi.mock).toEqual(expect.any(Function));
        expect(serviceApi.mockAll).toEqual(expect.any(Function));
        expect(serviceApi.resetAllMocks).toEqual(expect.any(Function));
        expect(serviceApi.restoreAllMocks).toEqual(expect.any(Function));
      });

      it('should continue with non-electron capabilities', async () => {
        instance = new WorkerService();
        const electronInstance = {
          requestedCapabilities: {
            browserName: 'chrome',
          },
          waitUntil: vi.fn().mockImplementation(async (condition) => {
            await condition();
          }),
          execute: vi.fn().mockResolvedValue(true),
          getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
          switchToWindow: vi.fn(),
          getPuppeteer: vi.fn(),
          electron: {}, // Let the service initialize this
        } as unknown as WebdriverIO.Browser;

        const browser = {
          instances: ['electron'],
          getInstance: (name: string) => (name === 'electron' ? electronInstance : undefined),
          execute: vi.fn().mockResolvedValue(true),
          isMultiremote: true,
        } as unknown as WebdriverIO.MultiRemoteBrowser;

        await instance.before({}, [], browser);

        // expect electron is not set to electron browser
        const serviceApi = electronInstance.electron;

        expect(serviceApi).toStrictEqual({});
      });
    });

    it('should copy original api', async () => {
      instance = new WorkerService();
      const browser = {
        waitUntil: vi.fn().mockImplementation(async (condition) => {
          await condition();
        }),
        execute: vi.fn().mockResolvedValue(true),
        getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
        switchToWindow: vi.fn(),
        getPuppeteer: vi.fn(),
        electron: {}, // Let the service initialize this
      } as unknown as WebdriverIO.Browser;

      await instance.before({}, [], browser);

      // emulate the call to copyOriginalApi
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCopyOriginalApi = vi.mocked(execute).mock.calls[0][2] as any;
      const dummyElectron = {
        dialog: {
          showOpenDialog: vi.fn(),
        },
      };
      await internalCopyOriginalApi(dummyElectron);

      // check if the originalApi is copied from the electron object
      expect(globalThis.originalApi).toMatchObject(dummyElectron);
    });
  });
});
