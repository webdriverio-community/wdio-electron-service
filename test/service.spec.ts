import { describe, beforeEach, it, expect, vi } from 'vitest';

import { mockProcessProperty } from './helpers';
import type { BrowserExtension } from '../src';
import type ElectronWorkerService from '../src/service';

interface CustomBrowserExtension extends BrowserExtension {
  electron: BrowserExtension['electron'] & {
    customApi?: (...arg: unknown[]) => Promise<unknown>;
  };
}

let WorkerService: typeof ElectronWorkerService;
let instance: ElectronWorkerService | undefined;

describe('options validation', () => {
  beforeEach(async () => {
    mockProcessProperty('platform', 'darwin');
    WorkerService = (await import('../src/service')).default;
  });

  it('should throw an error when there is a custom API command collision', () => {
    expect(() => {
      new WorkerService({
        appBinaryPath: '/mock/dist',
        customApiBrowserCommand: 'app',
      });
    }).toThrow('The command "app" is reserved, please provide a different value for customApiBrowserCommand');
  });
});

describe('before', () => {
  const addCommandMock = vi.fn();

  beforeEach(async () => {
    mockProcessProperty('platform', 'darwin');
    WorkerService = (await import('../src/service')).default;
  });

  it('should add API commands to the browser object', () => {
    instance = new WorkerService({
      appBinaryPath: 'workspace/my-test-app/dist',
      customApiBrowserCommand: 'customApi',
    });
    const browser = {
      addCommand: addCommandMock,
    } as unknown as WebdriverIO.Browser;
    instance.before({}, [], browser);
    const electronApi = browser.electron as CustomBrowserExtension['electron'];
    expect(electronApi.app).toEqual(expect.any(Function));
    expect(electronApi.browserWindow).toEqual(expect.any(Function));
    expect(electronApi.customApi).toEqual(expect.any(Function));
    expect(electronApi.dialog).toEqual(expect.any(Function));
    expect(electronApi.mainProcess).toEqual(expect.any(Function));
    expect(electronApi.mock).toEqual(expect.any(Function));
  });
});
