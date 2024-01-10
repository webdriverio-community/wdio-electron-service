import { vi, describe, beforeEach, it, expect } from 'vitest';

import { execute } from '../../src/commands/execute';

describe('execute', () => {
  beforeEach(async () => {
    globalThis.browser = {
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
    // @ts-expect-error undefined browser argument
    await expect(() => execute(undefined, 'return 1 + 2 + 3')).rejects.toThrowError(
      new Error('WDIO browser is not yet initialised'),
    );
  });

  it('should throw an error when the context bridge is not available', async () => {
    delete globalThis.wdioElectron;
    await expect(() => execute(globalThis.browser, () => 1 + 2 + 3)).rejects.toThrowError(
      new Error(
        'Electron context bridge not available! ' +
          'Did you import the service hook scripts into your application via e.g. ' +
          "`import('wdio-electron-service/main')` and `import('wdio-electron-service/preload')`?\n\n" +
          'Find more information at https://webdriver.io/docs/desktop-testing/electron#api-configuration',
      ),
    );
  });

  it('should execute a function', async () => {
    await execute(globalThis.browser, (a, b, c) => a + b + c, 1, 2, 3);
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), '(a, b, c) => a + b + c', 1, 2, 3);
    expect(globalThis.wdioElectron.execute).toHaveBeenCalledWith('(a, b, c) => a + b + c', [1, 2, 3]);
  });

  it('should execute a stringified function', async () => {
    await execute(globalThis.browser, '() => 1 + 2 + 3');
    expect(globalThis.browser.execute).toHaveBeenCalledWith('() => 1 + 2 + 3');
    expect(globalThis.wdioElectron.execute).not.toHaveBeenCalled();
  });
});
