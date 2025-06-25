import { vi, describe, beforeEach, it, expect } from 'vitest';
import type { ElectronMock } from '@wdio/electron-types';

import { mockProcessProperty } from './helpers.js';
import * as commands from '../src/commands/index.js';
import mockStore from '../src/mockStore.js';
import ElectronWorkerService from '../src/service.js';
import { clearPuppeteerSessions, ensureActiveWindowFocus } from '../src/window.js';
import { waitUntilWindowAvailable } from '../src/serviceCdp.js';

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
  return {};
});

vi.mock('../src/serviceCdp', () => {
  return {
    waitUntilWindowAvailable: vi.fn(),
    before: vi.fn().mockImplementation(function (this: any, _capabilities: any, instance: any) {
      this.browser = instance;
    }),
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
        electron: {},
      } as unknown as WebdriverIO.Browser;
    });

    it('should use CDP bridge', async () => {
      instance = new ElectronWorkerService({}, {});
      const beforeSpy = vi.spyOn(instance, 'before');

      await instance.before({}, [], browser);

      expect(beforeSpy).toHaveBeenCalled();
    });
  });

  describe('beforeTest()', () => {
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
    it('should call mock.update for mocks when command is user action command', async () => {
      const mockInstance = {
        update: vi.fn(),
        getMockName: vi.fn().mockReturnValue('test-mock'),
      } as unknown as ElectronMock;

      mockStore.setMock(mockInstance);

      instance = new ElectronWorkerService({}, {});
      await instance.before({}, [], browser);
      await instance.afterCommand('click', []);

      expect(mockInstance.update).toHaveBeenCalled();
    });

    it('should not call mock.update for mocks when command is not user action command', async () => {
      const mockInstance = {
        update: vi.fn(),
        getMockName: vi.fn().mockReturnValue('test-mock'),
      } as unknown as ElectronMock;

      mockStore.setMock(mockInstance);

      instance = new ElectronWorkerService({}, {});
      await instance.before({}, [], browser);
      await instance.afterCommand('getUrl', []);

      expect(mockInstance.update).not.toHaveBeenCalled();
    });

    it('should not call mock.update for internal commands', async () => {
      const mockInstance = {
        update: vi.fn(),
        getMockName: vi.fn().mockReturnValue('test-mock'),
      } as unknown as ElectronMock;

      mockStore.setMock(mockInstance);

      instance = new ElectronWorkerService({}, {});
      await instance.before({}, [], browser);
      await instance.afterCommand('click', [{ internal: true }]);

      expect(mockInstance.update).not.toHaveBeenCalled();
    });
  });

  describe('after()', () => {
    it('should call clearPuppeteerSessions', async () => {
      instance = new ElectronWorkerService({}, {});
      await instance.before({}, [], browser);
      await instance.after();

      expect(clearPuppeteerSessions).toHaveBeenCalled();
    });
  });
});
