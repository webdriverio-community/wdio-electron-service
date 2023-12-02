import { vi, describe, beforeEach, it, expect } from 'vitest';

import { execute } from '../../src/commands/execute';
import ElectronWorkerService from '../../src';
import { CONTEXT_BRIDGE_NOT_AVAILABLE } from '../../src/constants';

describe('execute', () => {
  let workerService;
  beforeEach(async () => {
    globalThis.browser = {
      execute: vi.fn(),
    } as unknown as WebdriverIO.Browser;
    workerService = new ElectronWorkerService({});
    workerService.browser = globalThis.browser;
  });

  it('should throw an error when called with a parameter of the wrong type', async () => {
    await expect(() => execute.call(workerService, {})).rejects.toThrowError(
      new Error('Expecting script to be type of "string" or "function"'),
    );
  });

  it('should throw an error when called without a parameter', async () => {
    await expect(() => execute.call(workerService)).rejects.toThrowError(
      new Error('Expecting script to be type of "string" or "function"'),
    );
  });

  it('should throw an error when the browser is not initialised', async () => {
    workerService.browser = undefined;
    await expect(() => execute.call(workerService, 'return 1 + 2 + 3')).rejects.toThrowError(
      new Error('WDIO browser is not yet initialised'),
    );
  });

  it('should execute a stringified function', async () => {
    await execute.call(workerService, 'return 1 + 2 + 3');
    expect(globalThis.browser.execute).toHaveBeenCalledWith('return 1 + 2 + 3');
  });

  it('should execute a function', async () => {
    await execute.call(workerService, () => 1 + 2 + 3);
    expect(globalThis.browser.execute).toHaveBeenCalledWith(
      expect.any(Function),
      CONTEXT_BRIDGE_NOT_AVAILABLE,
      '() => 1 + 2 + 3',
    );
  });
});
