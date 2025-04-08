import { vi, describe, beforeEach, it, expect } from 'vitest';
import type { BrowserExtension, ElectronMock } from '@wdio/electron-types';

import { mockProcessProperty } from './helpers.js';
import * as commands from '../src/commands/index.js';
import mockStore from '../src/mockStore.js';
import ElectronWorkerService from '../src/service.js';
import { ensureActiveWindowFocus } from '../src/window.js';
import { waitUntilWindowAvailable } from '../src/serviceCdp.js';

vi.mock('../src/window.js', () => {
  return {
    getActiveWindowHandle: vi.fn(),
    ensureActiveWindowFocus: vi.fn(),
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
  return {};
});

vi.mock('../src/serviceCdp', () => {
  return {
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
      instance = new ElectronWorkerService({ useCdpBridge: false }, {});

      window.wdioElectron = {
        execute: vi.fn(),
      };

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
        const capabilities = {
          alwaysMatch: {
            'browserName': 'electron',
            'wdio:electronServiceOptions': {},
          },
        } as unknown as WebdriverIO.Capabilities;

        instance = new ElectronWorkerService({ useCdpBridge: false }, capabilities);
        browser['requestedCapabilities'] = capabilities;

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
        const capabilities = {
          browserName: 'chrome',
        } as unknown as WebdriverIO.Capabilities;

        instance = new ElectronWorkerService({ useCdpBridge: false }, capabilities);
        browser['requestedCapabilities'] = capabilities;

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
    it.each([
      [`clearMocks`, commands.clearAllMocks],
      [`resetMocks`, commands.resetAllMocks],
      [`restoreMocks`, commands.restoreAllMocks],
    ])('should clear all mocks when `%s` is set', async (option, fn) => {
      instance = new ElectronWorkerService({ [option]: true, useCdpBridge: false }, {});
      await instance.before({}, [], browser);
      await instance.beforeTest();

      expect(fn).toHaveBeenCalled();
    });
  });

  describe('beforeCommand()', () => {
    beforeEach(() => {
      vi.mocked(ensureActiveWindowFocus).mockClear();
    });

    it('should call `ensureActiveWindowFocus` for all commands', async () => {
      instance = new ElectronWorkerService({ useCdpBridge: false }, {});
      await instance.before({}, [], browser);
      await instance.beforeCommand('dummyCommand', []);

      expect(ensureActiveWindowFocus).toHaveBeenCalledWith(browser, 'dummyCommand', undefined);
    });

    it('should not call `ensureActiveWindowFocus` for excluded commands', async () => {
      instance = new ElectronWorkerService({ useCdpBridge: false }, {});
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
      vi.mocked(mockStore.getMocks).mockImplementation(() => mocks);
    });

    it.each(['deleteSession'])('should not update mocks when the command is %s', async (commandName: string) => {
      instance = new ElectronWorkerService({ useCdpBridge: false }, {});
      mocks = [
        ['electron.app.getName', { update: vi.fn().mockResolvedValue({}) } as unknown as ElectronMock],
        ['electron.app.getVersion', { update: vi.fn().mockResolvedValue({}) } as unknown as ElectronMock],
      ];
      await instance.afterCommand(commandName, [['look', 'some', 'args']]);

      expect(mocks[0][1].update).not.toHaveBeenCalled();
      expect(mocks[1][1].update).not.toHaveBeenCalled();
    });

    it('should not update mocks when the command is `execute` and internal is set', async () => {
      instance = new ElectronWorkerService({ useCdpBridge: false }, {});
      mocks = [
        ['electron.app.getName', { update: vi.fn().mockResolvedValue({}) } as unknown as ElectronMock],
        ['electron.app.getVersion', { update: vi.fn().mockResolvedValue({}) } as unknown as ElectronMock],
      ];
      await instance.afterCommand('execute', [['look', 'some', 'args'], { internal: true }]);

      expect(mocks[0][1].update).not.toHaveBeenCalled();
      expect(mocks[1][1].update).not.toHaveBeenCalled();
    });

    it('should update mocks when the command is `execute` and internal is not set', async () => {
      instance = new ElectronWorkerService({ useCdpBridge: false }, {});
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
