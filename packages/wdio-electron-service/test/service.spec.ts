import type { BrowserExtension, ElectronMock } from '@wdio/electron-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execute } from '../src/commands/executeCdp.js';
import * as commands from '../src/commands/index.js';
import mockStore from '../src/mockStore.js';
import ElectronWorkerService, { waitUntilWindowAvailable } from '../src/service.js';
import { clearPuppeteerSessions, ensureActiveWindowFocus } from '../src/window.js';
import { mockProcessProperty } from './helpers.js';

vi.mock('@wdio/electron-utils');

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

  describe('afterCommand()', () => {
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
        electron: {},
      } as unknown as WebdriverIO.Browser;
    });

    it('should call mock.update and __markForUpdate for mocks when command is user action command', async () => {
      const mockInstance = {
        update: vi.fn(),
        getMockName: vi.fn().mockReturnValue('test-mock'),
        __markForUpdate: vi.fn(),
      } as unknown as ElectronMock;

      vi.mocked(mockStore.getMocks).mockReturnValue([['test-id', mockInstance]]);

      instance = new ElectronWorkerService({}, {});
      await instance.before({}, [], browser);
      await instance.afterCommand('click', []);

      // Both should be called for backwards compatibility (WDIO < 9.17.0) and forward compatibility (WDIO 9.17.0+)
      expect(mockInstance.update).toHaveBeenCalled();
      expect(mockInstance.__markForUpdate).toHaveBeenCalled();
    });

    it('should not call mock.update for mocks when command is not user action command', async () => {
      const mockInstance = {
        update: vi.fn(),
        getMockName: vi.fn().mockReturnValue('test-mock'),
        __markForUpdate: vi.fn(),
      } as unknown as ElectronMock;

      vi.mocked(mockStore.getMocks).mockReturnValue([['test-id', mockInstance]]);

      instance = new ElectronWorkerService({}, {});
      await instance.before({}, [], browser);
      await instance.afterCommand('getUrl', []);

      expect(mockInstance.update).not.toHaveBeenCalled();
      expect(mockInstance.__markForUpdate).not.toHaveBeenCalled();
    });

    it('should not call mock.update for internal commands', async () => {
      const mockInstance = {
        update: vi.fn(),
        getMockName: vi.fn().mockReturnValue('test-mock'),
        __markForUpdate: vi.fn(),
      } as unknown as ElectronMock;

      vi.mocked(mockStore.getMocks).mockReturnValue([['test-id', mockInstance]]);

      instance = new ElectronWorkerService({}, {});
      await instance.before({}, [], browser);
      await instance.afterCommand('click', [{ internal: true }]);

      expect(mockInstance.update).not.toHaveBeenCalled();
      expect(mockInstance.__markForUpdate).not.toHaveBeenCalled();
    });

    it('should handle mocks without __markForUpdate method gracefully', async () => {
      const mockInstance = {
        update: vi.fn(),
        getMockName: vi.fn().mockReturnValue('test-mock'),
        // No __markForUpdate method (for backwards compatibility)
      } as unknown as ElectronMock;

      vi.mocked(mockStore.getMocks).mockReturnValue([['test-id', mockInstance]]);

      instance = new ElectronWorkerService({}, {});
      await instance.before({}, [], browser);

      // Should not throw when __markForUpdate is undefined
      expect(async () => {
        await instance.afterCommand('click', []);
      }).not.toThrow();

      expect(mockInstance.update).toHaveBeenCalled();
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
        electron: {},
      } as unknown as WebdriverIO.Browser;

      await instance.before({}, [], browser);
      await instance.after();

      expect(clearPuppeteerSessions).toHaveBeenCalled();
    });
  });
});
