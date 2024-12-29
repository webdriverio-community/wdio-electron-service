import { vi, describe, beforeEach, it, expect, type Mock } from 'vitest';
import type { BrowserExtension, ElectronMock } from '@wdio/electron-types';

import { mockProcessProperty } from './helpers.js';
import { clearAllMocks } from '../src/commands/clearAllMocks.js';
import { resetAllMocks } from '../src/commands/resetAllMocks.js';
import { restoreAllMocks } from '../src/commands/restoreAllMocks.js';
import mockStore from '../src/mockStore.js';
import type ElectronWorkerService from '../src/service.js';
import { executeWindowManagement } from '../src/window.js';

let WorkerService: typeof ElectronWorkerService;
let instance: ElectronWorkerService | undefined;

beforeEach(async () => {
  mockProcessProperty('platform', 'darwin');
  WorkerService = (await import('../src/service.js')).default;
});

describe('before', () => {
  it('should add commands to the browser object', async () => {
    instance = new WorkerService();
    const browser = {
      waitUntil: vi.fn().mockResolvedValue(true),
      execute: vi.fn().mockResolvedValue(true),
      getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
    } as unknown as WebdriverIO.Browser;
    await instance.before({}, [], browser);
    const serviceApi = browser.electron as BrowserExtension['electron'];
    expect(serviceApi.clearAllMocks).toEqual(expect.any(Function));
    expect(serviceApi.execute).toEqual(expect.any(Function));
    expect(serviceApi.mock).toEqual(expect.any(Function));
    expect(serviceApi.mockAll).toEqual(expect.any(Function));
    expect(serviceApi.resetAllMocks).toEqual(expect.any(Function));
    expect(serviceApi.restoreAllMocks).toEqual(expect.any(Function));
    expect(serviceApi.windowHandle).toEqual('dummy');
  });

  describe('when multiremote', () => {
    it('should add commands to the browser object when multiremote', async () => {
      instance = new WorkerService();
      const browser = {
        instanceMap: {
          electron: {
            requestedCapabilities: { 'wdio:electronServiceOptions': {} },
            waitUntil: vi.fn().mockResolvedValue(true),
            execute: vi.fn().mockResolvedValue(true),
            getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
          },
          firefox: {
            requestedCapabilities: {},
            waitUntil: vi.fn().mockResolvedValue(true),
            getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
          },
        },
        isMultiremote: true,
        instances: ['electron', 'firefox'],
        getInstance: (instanceName: string) => browser.instanceMap[instanceName as keyof typeof browser.instanceMap],
        execute: vi.fn().mockResolvedValue(true),
      };
      instance.browser = browser as unknown as WebdriverIO.MultiRemoteBrowser;
      await instance.before({}, [], instance.browser);

      const electronInstance = instance.browser.getInstance('electron');
      const serviceApi = electronInstance.electron;
      expect(serviceApi.clearAllMocks).toEqual(expect.any(Function));
      expect(serviceApi.execute).toEqual(expect.any(Function));
      expect(serviceApi.mock).toEqual(expect.any(Function));
      expect(serviceApi.mockAll).toEqual(expect.any(Function));
      expect(serviceApi.resetAllMocks).toEqual(expect.any(Function));
      expect(serviceApi.restoreAllMocks).toEqual(expect.any(Function));
      expect(serviceApi.windowHandle).toEqual('dummy');

      const firefoxInstance = browser.getInstance('firefox') as unknown as BrowserExtension;
      expect(firefoxInstance.electron).toBeUndefined();
    });
  });
});

describe('beforeTest', () => {
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
    waitUntil: vi.fn().mockResolvedValue(true),
    execute: vi.fn().mockResolvedValue(true),
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

describe('beforeCommand', () => {
  vi.mock(import('../src/window.js'), async (importOriginal) => {
    const actual = await importOriginal();
    return {
      ...actual,
      executeWindowManagement: vi.fn(),
    };
  });
  const browser = {
    waitUntil: vi.fn().mockResolvedValue(true),
    execute: vi.fn().mockResolvedValue(true),
    getWindowHandles: vi.fn().mockResolvedValue(['dummy']),
  } as unknown as WebdriverIO.Browser;

  it('should call `executeWindowManagement`', async () => {
    instance = new WorkerService();
    await instance.before({}, [], browser);
    await instance.beforeCommand('dummyCommand');

    expect(executeWindowManagement).toHaveBeenCalled();
  });
});

describe('afterCommand', () => {
  let mocks: [string, ElectronMock][] = [];

  vi.mock('../src/mockStore', () => ({
    default: {
      getMocks: vi.fn(),
    },
  }));

  beforeEach(() => {
    (mockStore.getMocks as Mock).mockImplementation(() => mocks);
  });

  it('should not update mocks when the command is not `execute`', async () => {
    instance = new WorkerService();
    mocks = [
      ['electron.app.getName', { update: vi.fn().mockResolvedValue({}) } as unknown as ElectronMock],
      ['electron.app.getVersion', { update: vi.fn().mockResolvedValue({}) } as unknown as ElectronMock],
    ];
    await instance.afterCommand('someCommand', [['look', 'some', 'args']]);

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
