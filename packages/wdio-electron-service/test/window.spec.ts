import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getActiveWindowHandle, ensureActiveWindowFocus } from '../src/window.js';
import type { Browser as PuppeteerBrowser } from 'puppeteer-core';

vi.mock('@wdio/electron-utils/log', () => ({
  default: {
    trace: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Window Management', () => {
  describe('getActiveWindowHandle()', () => {
    describe('when no window', () => {
      it('should return undefined when no windows are available', async () => {
        const puppeteerBrowser = {
          targets: vi.fn().mockReturnValue([]),
        } as unknown as PuppeteerBrowser;

        const handle = await getActiveWindowHandle(puppeteerBrowser);
        expect(handle).toBe(undefined);
      });
    });

    describe('when 1 window', () => {
      it('should return the active window handle', async () => {
        const puppeteerBrowser = {
          targets: vi.fn().mockReturnValue([
            {
              type: vi.fn().mockReturnValue('page'),
              _targetId: 'window-1',
            },
          ]),
        } as unknown as PuppeteerBrowser;

        const handle = await getActiveWindowHandle(puppeteerBrowser);
        expect(handle).toBe('window-1');
      });
    });

    describe('when 2 or more windows', () => {
      it('should return the current window handle when active', async () => {
        const puppeteerBrowser = {
          targets: vi.fn().mockReturnValue([
            {
              type: vi.fn().mockReturnValue('page'),
              _targetId: 'window-1',
            },
            {
              type: vi.fn().mockReturnValue('page'),
              _targetId: 'window-2',
            },
          ]),
        } as unknown as PuppeteerBrowser;

        const handle = await getActiveWindowHandle(puppeteerBrowser, 'window-1');
        expect(handle).toBe('window-1');
      });

      it('should fallback to the first window handle when current is invalid', async () => {
        const puppeteerBrowser = {
          targets: vi.fn().mockReturnValue([
            {
              type: vi.fn().mockReturnValue('page'),
              _targetId: 'window-1',
            },
            {
              type: vi.fn().mockReturnValue('page'),
              _targetId: 'window-2',
            },
          ]),
        } as unknown as PuppeteerBrowser;

        const handle = await getActiveWindowHandle(puppeteerBrowser, 'invalid-window');
        expect(handle).toBe('window-1');
      });
    });
  });

  describe('ensureActiveWindowFocus()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should switch focus to the new window when it becomes active', async () => {
      const switchToWindowMock = vi.fn();
      const browser = {
        isMultiremote: false,
        electron: {
          windowHandle: 'currentWindow',
        },
        switchToWindow: switchToWindowMock,
      } as unknown as WebdriverIO.Browser;
      const puppeteerBrowser = {
        targets: vi.fn().mockReturnValue([
          {
            type: vi.fn().mockReturnValue('page'),
            _targetId: 'window-1',
          },
        ]),
      } as unknown as PuppeteerBrowser;
      await ensureActiveWindowFocus(browser as unknown as WebdriverIO.Browser, 'dummyCommand', puppeteerBrowser);
      expect(switchToWindowMock).toHaveBeenCalled();
      expect(browser.electron.windowHandle).toBe('window-1');
    });

    it('should maintain focus when staying on same window', async () => {
      const switchToWindowMock = vi.fn();
      const browser = {
        isMultiremote: false,
        electron: {
          windowHandle: 'currentWindow',
        },
        switchToWindow: switchToWindowMock,
      } as unknown as WebdriverIO.Browser;
      const puppeteerBrowser = {
        targets: vi.fn().mockReturnValue([
          {
            type: vi.fn().mockReturnValue('page'),
            _targetId: 'currentWindow',
          },
        ]),
      } as unknown as PuppeteerBrowser;
      await ensureActiveWindowFocus(browser as unknown as WebdriverIO.Browser, 'dummyCommand', puppeteerBrowser);
      expect(switchToWindowMock).not.toHaveBeenCalled();
      expect(browser.electron.windowHandle).toBe('currentWindow');
    });

    describe('MultiRemote', () => {
      const getBrowser = (newWindow = 'window1', current = 'currentWindow') => {
        const puppeteerBrowser = {
          targets: vi.fn().mockReturnValue([
            {
              type: vi.fn().mockReturnValue('page'),
              _targetId: newWindow,
            },
          ]),
        };

        const switchToWindowMock = vi.fn();
        const browser = {
          isMultiremote: false,
          electron: {
            windowHandle: current,
            execute: vi.fn(),
          },
          getPuppeteer: vi.fn().mockResolvedValue(puppeteerBrowser),
          switchToWindow: switchToWindowMock,
        } as unknown as WebdriverIO.Browser;
        return { browser, switchToWindowMock };
      };

      it('should switch focus to new windows in all browser instances', async () => {
        const { browser: browser1, switchToWindowMock: switchToWindowMock1 } = getBrowser();
        const { browser: browser2, switchToWindowMock: switchToWindowMock2 } = getBrowser();
        const mrBrowser = {
          isMultiremote: true,
          instances: ['browser1', 'browser2'],
          getInstance: (instance: string) => (instance === 'browser1' ? browser1 : browser2),
          electron: {
            execute: vi.fn(),
          },
        } as unknown as WebdriverIO.MultiRemoteBrowser;

        await ensureActiveWindowFocus(mrBrowser as unknown as WebdriverIO.Browser, 'dummyCommand');
        expect(switchToWindowMock1).toHaveBeenCalled();
        expect(switchToWindowMock2).toHaveBeenCalled();
      });

      it('should maintain focus when windows remain unchanged', async () => {
        const { browser: browser1, switchToWindowMock: switchToWindowMock1 } = getBrowser('currentWindow');
        const { browser: browser2, switchToWindowMock: switchToWindowMock2 } = getBrowser('currentWindow');
        const browser = {
          isMultiremote: true,
          instances: ['browser1', 'browser2'],
          getInstance: (instance: string) => (instance === 'browser1' ? browser1 : browser2),
        } as unknown as WebdriverIO.MultiRemoteBrowser;

        await ensureActiveWindowFocus(browser as unknown as WebdriverIO.Browser, 'dummyCommand');
        expect(switchToWindowMock1).not.toHaveBeenCalled();
        expect(switchToWindowMock2).not.toHaveBeenCalled();
      });
    });
  });
});
