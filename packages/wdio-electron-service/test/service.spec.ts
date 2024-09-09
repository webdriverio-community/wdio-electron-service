import { vi, describe, beforeEach, it, expect, Mock } from 'vitest';
import type { BrowserExtension, ElectronMock } from '@wdio/electron-types';

import { mockProcessProperty } from './helpers.js';
import { clearAllMocks } from '../src/commands/clearAllMocks.js';
import { resetAllMocks } from '../src/commands/resetAllMocks.js';
import { restoreAllMocks } from '../src/commands/restoreAllMocks.js';
import mockStore from '../src/mockStore.js';
import type ElectronWorkerService from '../src/service.js';

let WorkerService: typeof ElectronWorkerService;
let instance: ElectronWorkerService | undefined;

beforeEach(async () => {
  mockProcessProperty('platform', 'darwin');
  WorkerService = (await import('../src/service.js')).default;
});

describe('before', () => {
  it('should add commands to the browser object', () => {
    instance = new WorkerService();
    const browser = {
      waitUntil: vi.fn().mockResolvedValue(true),
    } as unknown as WebdriverIO.Browser;
    instance.before({}, [], browser);
    const serviceApi = browser.electron as BrowserExtension['electron'];
    expect(serviceApi.clearAllMocks).toEqual(expect.any(Function));
    expect(serviceApi.execute).toEqual(expect.any(Function));
    expect(serviceApi.mock).toEqual(expect.any(Function));
    expect(serviceApi.mockAll).toEqual(expect.any(Function));
    expect(serviceApi.resetAllMocks).toEqual(expect.any(Function));
    expect(serviceApi.restoreAllMocks).toEqual(expect.any(Function));
  });

  describe('when multiremote', () => {
    it('should add commands to the browser object when multiremote', () => {
      instance = new WorkerService();
      const browser = {
        instanceMap: {
          electron: {
            requestedCapabilities: { 'wdio:electronServiceOptions': {} },
            waitUntil: vi.fn().mockResolvedValue(true),
          },
          firefox: {
            requestedCapabilities: {},
            waitUntil: vi.fn().mockResolvedValue(true),
          },
        },
        isMultiremote: true,
        instances: ['electron', 'firefox'],
        getInstance: (instanceName: string) => browser.instanceMap[instanceName as keyof typeof browser.instanceMap],
      };
      instance.browser = browser as unknown as WebdriverIO.MultiRemoteBrowser;
      instance.before({}, [], instance.browser);

      const electronInstance = instance.browser.getInstance('electron');
      let serviceApi = electronInstance.electron;
      expect(serviceApi.clearAllMocks).toEqual(expect.any(Function));
      expect(serviceApi.execute).toEqual(expect.any(Function));
      expect(serviceApi.mock).toEqual(expect.any(Function));
      expect(serviceApi.mockAll).toEqual(expect.any(Function));
      expect(serviceApi.resetAllMocks).toEqual(expect.any(Function));
      expect(serviceApi.restoreAllMocks).toEqual(expect.any(Function));

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

  it('should clear all mocks when `clearMocks` is set', async () => {
    instance = new WorkerService({ clearMocks: true });
    const browser = {
      waitUntil: vi.fn().mockResolvedValue(true),
    } as unknown as WebdriverIO.Browser;
    instance.before({}, [], browser);
    await instance.beforeTest();

    expect(clearAllMocks).toHaveBeenCalled();
  });

  it('should reset all mocks when `resetMocks` is set', async () => {
    instance = new WorkerService({ resetMocks: true });
    const browser = {
      waitUntil: vi.fn().mockResolvedValue(true),
    } as unknown as WebdriverIO.Browser;
    instance.before({}, [], browser);
    await instance.beforeTest();

    expect(resetAllMocks).toHaveBeenCalled();
  });

  it('should restore all mocks when `restoreMocks` is set', async () => {
    instance = new WorkerService({ restoreMocks: true });
    const browser = {
      waitUntil: vi.fn().mockResolvedValue(true),
    } as unknown as WebdriverIO.Browser;
    instance.before({}, [], browser);
    await instance.beforeTest();

    expect(restoreAllMocks).toHaveBeenCalled();
  });
});

describe('afterCommand', () => {
  let mocks: [string, ElectronMock<any, any>][] = [];

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
