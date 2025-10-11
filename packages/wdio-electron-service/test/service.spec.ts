import type { BrowserExtension } from '@wdio/electron-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execute } from '../src/commands/executeCdp.js';
import * as commands from '../src/commands/index.js';
import ElectronWorkerService, { waitUntilWindowAvailable } from '../src/service.js';
import { clearPuppeteerSessions, ensureActiveWindowFocus } from '../src/window.js';
import { mockProcessProperty } from './helpers.js';

vi.mock('@wdio/electron-utils', () => import('./mocks/electron-utils.js'));

vi.mock('../src/window.js', () => {
  return {
    getActiveWindowHandle: vi.fn(),
    ensureActiveWindowFocus: vi.fn(),
    getPuppeteer: vi.fn(),
    clearPuppeteerSessions: vi.fn(),
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

vi.mock('../src/commands/execute', () => {
  return {
    execute: vi.fn(),
  };
});

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

vi.mock('../src/fuses', () => {
  return {
    checkInspectFuse: vi.fn().mockResolvedValue({ canUseCdpBridge: true }),
  };
});

vi.mock('../src/mockStore', () => {
  return {
    default: {
      getMocks: vi.fn().mockReturnValue([]),
      setMock: vi.fn(),
    },
  };
});

// Mock waitUntilWindowAvailable function specifically
vi.mock('../src/service', async () => {
  const actual = await vi.importActual('../src/service.js');
  return {
    ...actual,
    waitUntilWindowAvailable: vi.fn(),
  };
});

let instance: ElectronWorkerService | undefined;

beforeEach(async () => {
  mockProcessProperty('platform', 'darwin');
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  vi.mocked(waitUntilWindowAvailable).mockImplementation(async () => Promise.resolve());
});

describe('Electron Worker Service', () => {
  let browser: WebdriverIO.Browser;

  describe('before()', () => {
    beforeEach(() => {
      vi.clearAllMocks();

      browser = {
        sessionId: 'dummyId',
        waitUntil: vi.fn().mockImplementation(async (condition) => {
          await condition();
        }),
        execute: vi.fn().mockImplementation((fn) => fn()),
        getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
        switchToWindow: vi.fn(),
        getPuppeteer: vi.fn(),
        overwriteCommand: vi.fn(),
        electron: {}, // Let the service initialize this
      } as unknown as WebdriverIO.Browser;
    });

    it('should use CDP bridge', async () => {
      instance = new ElectronWorkerService({}, {});
      const beforeSpy = vi.spyOn(instance, 'before');

      await instance.before({}, [], browser);

      expect(beforeSpy).toHaveBeenCalled();
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

    it('should install element command overrides with overwriteCommand', async () => {
      instance = new ElectronWorkerService({}, {});

      await instance.before({}, [], browser);

      const oc = vi.mocked((browser as any).overwriteCommand);
      const calls = oc.mock.calls;
      // overwriteCommand signature: (name, wrapper, isElement?)
      const overridden = calls.map((c: unknown[]) => ({ name: c[0], isElement: c[2] }));
      expect(overridden).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'click', isElement: true }),
          expect.objectContaining({ name: 'doubleClick', isElement: true }),
          expect.objectContaining({ name: 'setValue', isElement: true }),
          expect.objectContaining({ name: 'clearValue', isElement: true }),
        ]),
      );
    });

    it('should update mocks after overridden element command executes', async () => {
      instance = new ElectronWorkerService({}, {});
      await instance.before({}, [], browser);

      // Prepare mock store to return a mock with update()
      const storeModule = (await import('../src/mockStore.js')) as any;
      const mockObj = { update: vi.fn().mockResolvedValue(undefined) };
      storeModule.default.getMocks.mockReturnValueOnce([['id', mockObj]]);

      // Find the override for 'click' and invoke it
      const oc = vi.mocked((browser as any).overwriteCommand);
      const clickCall = oc.mock.calls.find((c: unknown[]) => c[0] === 'click');
      expect(clickCall).toBeDefined();
      const overrideFn = clickCall?.[1] as unknown as (
        this: WebdriverIO.Element,
        original: (...args: unknown[]) => Promise<unknown>,
        ...args: unknown[]
      ) => Promise<unknown>;

      const original = vi.fn().mockResolvedValue('ok');
      await overrideFn?.call({} as unknown as WebdriverIO.Element, original);

      expect(mockObj.update).toHaveBeenCalledTimes(1);
      expect(original).toHaveBeenCalled();
    });

    it('should copy original api', async () => {
      instance = new ElectronWorkerService({}, {});

      await instance.before({}, [], browser);

      // emulate the call to copyOriginalApi
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

    describe('when multiremote', () => {
      it('should add electron commands to the browser object', async () => {
        instance = new ElectronWorkerService({}, {});
        browser.requestedCapabilities = {
          alwaysMatch: {
            browserName: 'electron',
            'wdio:electronServiceOptions': {},
          },
        };

        const rootBrowser = {
          instances: ['electron'],
          getInstance: (name: string) => (name === 'electron' ? browser : undefined),
          execute: vi.fn().mockResolvedValue(true),
          isMultiremote: true,
          overwriteCommand: vi.fn(),
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

        browser.requestedCapabilities = {
          browserName: 'chrome',
        };

        const rootBrowser = {
          instances: ['electron'],
          getInstance: (name: string) => (name === 'electron' ? browser : undefined),
          execute: vi.fn().mockResolvedValue(true),
          isMultiremote: true,
          overwriteCommand: vi.fn(),
        } as unknown as WebdriverIO.MultiRemoteBrowser;

        await instance.before({}, [], rootBrowser);

        // expect electron is not set to electron browser
        const serviceApi = browser.electron;

        expect(serviceApi).toStrictEqual({});
      });
    });
  });

  describe('beforeTest()', () => {
    beforeEach(() => {
      browser = {
        sessionId: 'dummyId',
        waitUntil: vi.fn().mockImplementation(async (condition) => {
          await condition();
        }),
        execute: vi.fn().mockImplementation((fn) => fn()),
        getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
        switchToWindow: vi.fn(),
        getPuppeteer: vi.fn(),
        overwriteCommand: vi.fn(),
        electron: {},
      } as unknown as WebdriverIO.Browser;
    });

    it.each([
      [`clearMocks`, commands.clearAllMocks],
      [`resetMocks`, commands.resetAllMocks],
      [`restoreMocks`, commands.restoreAllMocks],
    ])('should clear all mocks when `%s` is set', async (option, fn) => {
      instance = new ElectronWorkerService({ [option]: true }, {});
      await instance.before({}, [], browser);
      await instance.beforeTest();

      expect(fn).toHaveBeenCalled();
    });
  });

  describe('beforeCommand()', () => {
    beforeEach(() => {
      vi.mocked(ensureActiveWindowFocus).mockClear();

      browser = {
        sessionId: 'dummyId',
        waitUntil: vi.fn().mockImplementation(async (condition) => {
          await condition();
        }),
        execute: vi.fn().mockImplementation((fn) => fn()),
        getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
        switchToWindow: vi.fn(),
        getPuppeteer: vi.fn(),
        overwriteCommand: vi.fn(),
        electron: {},
      } as unknown as WebdriverIO.Browser;
    });

    it('should call `ensureActiveWindowFocus` for all commands', async () => {
      instance = new ElectronWorkerService({}, {});
      await instance.before({}, [], browser);
      await instance.beforeCommand('dummyCommand', []);

      expect(ensureActiveWindowFocus).toHaveBeenCalledWith(browser, 'dummyCommand');
    });

    it('should not call `ensureActiveWindowFocus` for excluded commands', async () => {
      instance = new ElectronWorkerService({}, {});
      await instance.before({}, [], browser);
      await instance.beforeCommand('getWindowHandles', []);

      expect(ensureActiveWindowFocus).toHaveBeenCalledTimes(0);
    });

    it('should not call `ensureActiveWindowFocus` for internal commands', async () => {
      instance = new ElectronWorkerService({}, {});
      await instance.before({}, [], browser);
      await instance.beforeCommand('dummyCommand', [{ internal: true }]);

      expect(ensureActiveWindowFocus).toHaveBeenCalledTimes(0);
    });
  });

  describe('after()', () => {
    it('should call clearPuppeteerSessions', async () => {
      instance = new ElectronWorkerService({}, {});
      browser = {
        sessionId: 'dummyId',
        waitUntil: vi.fn().mockImplementation(async (condition) => {
          await condition();
        }),
        execute: vi.fn().mockImplementation((fn) => fn()),
        getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
        switchToWindow: vi.fn(),
        getPuppeteer: vi.fn(),
        overwriteCommand: vi.fn(),
        electron: {},
      } as unknown as WebdriverIO.Browser;

      await instance.before({}, [], browser);
      await instance.after();

      expect(clearPuppeteerSessions).toHaveBeenCalled();
    });
  });
});
