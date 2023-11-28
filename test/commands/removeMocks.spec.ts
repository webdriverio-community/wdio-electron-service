import { vi, describe, beforeEach, it, expect } from 'vitest';

import { removeMocks } from '../../src/commands/removeMocks';
import { mock } from '../../src/commands/mock';
import type { BrowserExtension } from '../../src';

interface CustomBrowserExtension extends BrowserExtension {
  electron: BrowserExtension['electron'];
}

describe('removeMocks', () => {
  beforeEach(async () => {
    globalThis.browser = {
      electron: {
        _mocks: {},
      },
    } as unknown as WebdriverIO.Browser;
    (globalThis.browser as CustomBrowserExtension).electron.execute = vi.fn().mockResolvedValue("['app','dialog']");
    await mock('app');
    await mock('dialog');
    (globalThis.browser as CustomBrowserExtension).electron._mocks.app.unMock = vi
      .fn()
      .mockResolvedValue(globalThis.browser.electron._mocks.app);
    (globalThis.browser as CustomBrowserExtension).electron._mocks.dialog.unMock = vi
      .fn()
      .mockResolvedValue(globalThis.browser.electron._mocks.dialog);
  });

  it('should remove the expected mock functions', async () => {
    await removeMocks('app');
    expect((globalThis.browser as CustomBrowserExtension).electron._mocks.app.unMock).toHaveBeenCalled();
    expect((globalThis.browser as CustomBrowserExtension).electron._mocks.dialog.unMock).not.toHaveBeenCalled();
  });

  it('should remove all mock functions when no apiName is specified', async () => {
    await removeMocks();
    expect((globalThis.browser as CustomBrowserExtension).electron._mocks.app.unMock).toHaveBeenCalled();
    expect((globalThis.browser as CustomBrowserExtension).electron._mocks.dialog.unMock).toHaveBeenCalled();
  });
});
