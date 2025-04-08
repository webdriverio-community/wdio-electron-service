import { vi, describe, beforeEach, it, expect } from 'vitest';
import type { BrowserExtension } from '@wdio/electron-types';

import { mockProcessProperty } from './helpers.js';
import { execute } from '../src/commands/executeCdp.js';
import ElectronWorkerService from '../src/service.js';

vi.mock('@wdio/electron-utils/log');

vi.mock('../src/window.js', () => {
  return {
    getActiveWindowHandle: vi.fn(),
  };
});

vi.mock('../src/commands/executeCdp', () => {
  return {
    execute: vi.fn(),
  };
});

vi.mock('../src/mockStore', () => {
  return {
    default: vi.fn(),
  };
});

vi.mock('../src/commands/execute', () => {
  return {
    execute: vi.fn(),
  };
});

vi.mock('../src/commands/index', () => {
  return {
    isMockFunction: vi.fn(),
    mock: vi.fn(),
    mockAll: vi.fn(),
    clearAllMocks: vi.fn(),
    resetAllMocks: vi.fn(),
    restoreAllMocks: vi.fn(),
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

let instance: ElectronWorkerService | undefined;

beforeEach(async () => {
  mockProcessProperty('platform', 'darwin');
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('Electron Worker Service', () => {
  let browser: WebdriverIO.Browser;

  describe('before()', () => {
    beforeEach(() => {
      vi.clearAllMocks();

      browser = {
        waitUntil: vi.fn().mockImplementation(async (condition) => {
          await condition();
        }),
        execute: vi.fn().mockImplementation((fn) => fn()),
        getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
        switchToWindow: vi.fn(),
        getPuppeteer: vi.fn(),
        electron: {}, // Let the service initialize this
      } as unknown as WebdriverIO.Browser;
    });

    it('should add electron commands to the browser object', async () => {
      instance = new ElectronWorkerService({}, {});

      await instance.before({}, [], browser);

      const serviceApi = browser.electron as BrowserExtension['electron'];
      expect(serviceApi.clearAllMocks).toEqual(expect.any(Function));
      expect(serviceApi.execute).toEqual(expect.any(Function));
      expect(serviceApi.mock).toEqual(expect.any(Function));
      expect(serviceApi.mockAll).toEqual(expect.any(Function));
      expect(serviceApi.resetAllMocks).toEqual(expect.any(Function));
      expect(serviceApi.restoreAllMocks).toEqual(expect.any(Function));
    });

    describe('when multiremote', () => {
      it('should add electron commands to the browser object', async () => {
        instance = new ElectronWorkerService({}, {});
        browser['requestedCapabilities'] = {
          alwaysMatch: {
            'browserName': 'electron',
            'wdio:electronServiceOptions': {},
          },
        };

        const rootBrowser = {
          instances: ['electron'],
          getInstance: (name: string) => (name === 'electron' ? browser : undefined),
          execute: vi.fn().mockResolvedValue(true),
          isMultiremote: true,
        } as unknown as WebdriverIO.MultiRemoteBrowser;

        await instance.before({}, [], rootBrowser);

        // expect electron is set to root browser
        const rootServiceApi = rootBrowser.electron;
        expect(rootServiceApi.clearAllMocks).toEqual(expect.any(Function));
        expect(rootServiceApi.execute).toEqual(expect.any(Function));
        expect(rootServiceApi.mock).toEqual(expect.any(Function));
        expect(rootServiceApi.mockAll).toEqual(expect.any(Function));
        expect(rootServiceApi.resetAllMocks).toEqual(expect.any(Function));
        expect(rootServiceApi.restoreAllMocks).toEqual(expect.any(Function));

        // expect electron is set to electron browser
        const serviceApi = browser.electron;
        expect(serviceApi.clearAllMocks).toEqual(expect.any(Function));
        expect(serviceApi.execute).toEqual(expect.any(Function));
        expect(serviceApi.mock).toEqual(expect.any(Function));
        expect(serviceApi.mockAll).toEqual(expect.any(Function));
        expect(serviceApi.resetAllMocks).toEqual(expect.any(Function));
        expect(serviceApi.restoreAllMocks).toEqual(expect.any(Function));
      });

      it('should continue with non-electron capabilities', async () => {
        instance = new ElectronWorkerService({}, {});

        browser['requestedCapabilities'] = {
          browserName: 'chrome',
        };

        const rootBrowser = {
          instances: ['electron'],
          getInstance: (name: string) => (name === 'electron' ? browser : undefined),
          execute: vi.fn().mockResolvedValue(true),
          isMultiremote: true,
        } as unknown as WebdriverIO.MultiRemoteBrowser;

        await instance.before({}, [], rootBrowser);

        // expect electron is not set to electron browser
        const serviceApi = browser.electron;

        expect(serviceApi).toStrictEqual({});
      });
    });

    it('should copy original api', async () => {
      instance = new ElectronWorkerService({}, {});

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
