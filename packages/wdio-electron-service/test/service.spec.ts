import { vi, describe, beforeEach, it, expect, type Mock } from 'vitest';
import type { BrowserExtension, ElectronMock } from '@wdio/electron-types';

import { mockProcessProperty } from './helpers.js';
import { clearAllMocks } from '../src/commands/clearAllMocks.js';
import { resetAllMocks } from '../src/commands/resetAllMocks.js';
import { restoreAllMocks } from '../src/commands/restoreAllMocks.js';
import mockStore from '../src/mockStore.js';
import type ElectronWorkerService from '../src/service.js';
import { ensureActiveWindowFocus } from '../src/window.js';

vi.mock('../src/window.js');

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

      window.wdioElectron = {
        execute: vi.fn(),
      };

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
  });

  describe('beforeTest()', () => {
    vi.mock('../src/commands/clearAllMocks.js', () => ({
      clearAllMocks: vi.fn().mockReturnValue({}),
    }));
    vi.mock('../src/commands/resetAllMocks.js', () => ({
      resetAllMocks: vi.fn().mockReturnValue({}),
    }));
    vi.mock('../src/commands/restoreAllMocks.js', () => ({
      restoreAllMocks: vi.fn().mockReturnValue({}),
    }));

    const browser = {
      waitUntil: vi.fn().mockImplementation(async (condition) => {
        await condition();
      }),
      execute: vi.fn().mockResolvedValue(true),
      getPuppeteer: vi.fn(),
      getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
    } as unknown as WebdriverIO.Browser;

    it.each([
      [`clearMocks`, clearAllMocks],
      [`resetMocks`, resetAllMocks],
      [`restoreMocks`, restoreAllMocks],
    ])('should clear all mocks when `%s` is set', async (option, fn) => {
      instance = new WorkerService({ [option]: true });
      await instance.before({}, [], browser);
      await instance.beforeTest();

      expect(fn).toHaveBeenCalled();
    });

    describe('when setting options in capabilities', () => {
      it.each([
        [`clearMocks`, clearAllMocks],
        [`resetMocks`, resetAllMocks],
        [`restoreMocks`, restoreAllMocks],
      ])('should clear all mocks when `%s` is set in capabilities', async (option, fn) => {
        instance = new WorkerService();
        await instance.before({ 'wdio:electronServiceOptions': { [option]: true } }, [], browser);
        await instance.beforeTest();

        expect(fn).toHaveBeenCalled();
      });
    });
  });

  describe('beforeCommand()', () => {
    const browser = {
      waitUntil: vi.fn().mockImplementation(async (condition) => {
        await condition();
      }),
      execute: vi.fn().mockResolvedValue(true),
      getPuppeteer: vi.fn(),
      getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
    } as unknown as WebdriverIO.Browser;

    beforeEach(() => {
      vi.mocked(ensureActiveWindowFocus).mockClear();
    });

    it('should call `ensureActiveWindowFocus` for all commands', async () => {
      instance = new WorkerService();
      await instance.before({}, [], browser);
      await instance.beforeCommand('dummyCommand', []);

      expect(ensureActiveWindowFocus).toHaveBeenCalledWith(browser, 'dummyCommand', undefined);
    });

    it('should not call `ensureActiveWindowFocus` for excluded commands', async () => {
      instance = new WorkerService();
      await instance.before({}, [], browser);
      await instance.beforeCommand('getWindowHandles', []);

      expect(ensureActiveWindowFocus).toHaveBeenCalledTimes(0);
    });
  });

  describe('afterCommand()', () => {
    let mocks: [string, ElectronMock][] = [];

    vi.mock('../src/mockStore', () => ({
      default: {
        getMocks: vi.fn(),
      },
    }));

    beforeEach(() => {
      (mockStore.getMocks as Mock).mockImplementation(() => mocks);
    });

    it.each(['deleteSession'])('should not update mocks when the command is %s', async (commandName: string) => {
      instance = new WorkerService();
      mocks = [
        ['electron.app.getName', { update: vi.fn().mockResolvedValue({}) } as unknown as ElectronMock],
        ['electron.app.getVersion', { update: vi.fn().mockResolvedValue({}) } as unknown as ElectronMock],
      ];
      await instance.afterCommand(commandName, [['look', 'some', 'args']]);

      expect(mocks[0][1].update).not.toHaveBeenCalled();
      expect(mocks[1][1].update).not.toHaveBeenCalled();
    });

    it('should not update mocks when the command is `execute` and internal is set', async () => {
      instance = new WorkerService();
      mocks = [
        ['electron.app.getName', { update: vi.fn().mockResolvedValue({}) } as unknown as ElectronMock],
        ['electron.app.getVersion', { update: vi.fn().mockResolvedValue({}) } as unknown as ElectronMock],
      ];
      await instance.afterCommand('execute', [['look', 'some', 'args'], { internal: true }]);

      expect(mocks[0][1].update).not.toHaveBeenCalled();
      expect(mocks[1][1].update).not.toHaveBeenCalled();
    });

    it('should update mocks when the command is `execute` and internal is not set', async () => {
      instance = new WorkerService();
      mocks = [
        ['electron.app.getName', { update: vi.fn().mockResolvedValue({}) } as unknown as ElectronMock],
        ['electron.app.getVersion', { update: vi.fn().mockResolvedValue({}) } as unknown as ElectronMock],
      ];
      await instance.afterCommand('execute', [['look', 'some', 'args']]);

      expect(mocks[0][1].update).toHaveBeenCalled();
      expect(mocks[1][1].update).toHaveBeenCalled();
    });
  });
});
