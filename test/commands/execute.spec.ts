import { vi, describe, beforeEach, it, expect } from 'vitest';

import { execute } from '../../src/commands/execute';

describe('execute', () => {
  beforeEach(async () => {
    globalThis.browser = {
      execute: vi.fn(),
    } as unknown as WebdriverIO.Browser;
  });

  it('should throw an error when called with a script argument of the wrong type', async () => {
    await expect(() => execute(globalThis.browser, {} as string)).rejects.toThrowError(
      new Error('Expecting script to be type of "string" or "function"'),
    );
  });

  it('should throw an error when called without a script argument', async () => {
    // @ts-expect-error no script argument
    await expect(() => execute(globalThis.browser)).rejects.toThrowError(
      new Error('Expecting script to be type of "string" or "function"'),
    );
  });

  it('should throw an error when the browser is not initialised', async () => {
    // @ts-expect-error undefined browser argument
    await expect(() => execute(undefined, 'return 1 + 2 + 3')).rejects.toThrowError(
      new Error('WDIO browser is not yet initialised'),
    );
  });

  it('should execute a stringified function', async () => {
    await execute(globalThis.browser, 'return 1 + 2 + 3');
    expect(globalThis.browser.execute).toHaveBeenCalledWith('return 1 + 2 + 3');
  });

  it('should execute a function', async () => {
    await execute(globalThis.browser, () => 1 + 2 + 3);
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), '() => 1 + 2 + 3');
  });
});
