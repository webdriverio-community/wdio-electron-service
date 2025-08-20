import { beforeEach, describe, expect, it, vi } from 'vitest';

import { execute } from '../../src/commands/execute.js';

describe('execute Command', () => {
  beforeEach(async () => {
    globalThis.browser = {
      electron: {},
      execute: vi.fn((fn: (script: string, ...args: unknown[]) => unknown, script: string, ...args: unknown[]) =>
        typeof fn === 'string' ? new Function(`return (${fn}).apply(this, arguments)`)() : fn(script, ...args),
      ),
    } as unknown as WebdriverIO.Browser;

    globalThis.wdioElectron = {
      execute: vi.fn(),
    };
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
    // @ts-expect-error no browser argument
    await expect(() => execute(undefined, '() => 1 + 2 + 3')).rejects.toThrowError(
      new Error('WDIO browser is not yet initialised'),
    );
  });

  it('should execute a function', async () => {
    await execute(globalThis.browser, (a, b, c) => a + b + c, 1, 2, 3);
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), '(a, b, c) => a + b + c', 1, 2, 3);
    expect(globalThis.wdioElectron.execute).toHaveBeenCalledWith('(a, b, c) => a + b + c', [1, 2, 3]);
  });

  it('should execute a stringified function', async () => {
    await execute(globalThis.browser, '() => 1 + 2 + 3');
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), '() => 1 + 2 + 3');
    expect(globalThis.wdioElectron.execute).toHaveBeenCalledWith('() => 1 + 2 + 3', []);
  });
});
