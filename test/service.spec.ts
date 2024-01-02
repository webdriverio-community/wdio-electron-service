import { vi, describe, beforeEach, it, expect } from 'vitest';

import { mockProcessProperty } from './helpers';
import type { BrowserExtension } from '../src';
import type ElectronWorkerService from '../src/service';

let WorkerService: typeof ElectronWorkerService;
let instance: ElectronWorkerService | undefined;

describe('before', () => {
  beforeEach(async () => {
    mockProcessProperty('platform', 'darwin');
    WorkerService = (await import('../src/service')).default;
  });

  it('should add commands to the browser object', () => {
    instance = new WorkerService();
    const browser = {
      waitUntil: vi.fn().mockResolvedValue(true),
    } as unknown as WebdriverIO.Browser;
    instance.before({}, [], browser);
    const serviceApi = browser.electron as BrowserExtension['electron'];
    expect(serviceApi.execute).toEqual(expect.any(Function));
    expect(serviceApi.mock).toEqual(expect.any(Function));
    expect(serviceApi.mockAll).toEqual(expect.any(Function));
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
          firefox: { requestedCapabilities: {}, waitUntil: vi.fn().mockResolvedValue(true) },
        },
        isMultiremote: true,
        instances: ['electron', 'firefox'],
        getInstance: (instanceName: string) => browser.instanceMap[instanceName as keyof typeof browser.instanceMap],
      };
      instance.browser = browser as unknown as WebdriverIO.MultiRemoteBrowser;
      instance.before({}, [], instance.browser);

      const electronInstance = instance.browser.getInstance('electron');
      let serviceApi = electronInstance.electron;
      expect(serviceApi.execute).toEqual(expect.any(Function));
      expect(serviceApi.mock).toEqual(expect.any(Function));
      expect(serviceApi.mockAll).toEqual(expect.any(Function));
      expect(serviceApi.restoreAllMocks).toEqual(expect.any(Function));

      const firefoxInstance = browser.getInstance('firefox') as unknown as BrowserExtension;
      expect(firefoxInstance.electron).toBeUndefined();
    });
  });
});
