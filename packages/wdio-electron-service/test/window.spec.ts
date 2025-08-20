import type { Browser as PuppeteerBrowser } from 'puppeteer-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPuppeteerSessions, ensureActiveWindowFocus, getActiveWindowHandle, getPuppeteer } from '../src/window.js';

vi.mock('@wdio/electron-utils', () => import('./mocks/electron-utils.js'));

describe('Window Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPuppeteerSessions();
  });

  const getBrowser = (sessionId: string, newWindow = 'window1', current = 'currentWindow') => {
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
      sessionId,
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

  describe('getPuppeteer()', () => {
    it('should return puppeteer browser from the WDIO browser', async () => {
      const { browser } = getBrowser('browser1');
      await getPuppeteer(browser);
      expect(browser.getPuppeteer).toHaveBeenCalledTimes(1);
    });

    it('should return puppeteer browser from the cache', async () => {
      const { browser } = getBrowser('browser1');
      await getPuppeteer(browser);
      await getPuppeteer(browser);
      expect(browser.getPuppeteer).toHaveBeenCalledTimes(1);
    });
  });

  describe('getActiveWindowHandle()', () => {
    it('should return undefined when no puppeteer browser are inputted', async () => {
      // @ts-expect-error
      const handle = await getActiveWindowHandle(undefined);
      expect(handle).toBe(undefined);
    });

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
    it('should switch focus to the new window when it becomes active', async () => {
      const { browser, switchToWindowMock } = getBrowser('browser1');

      await ensureActiveWindowFocus(browser as unknown as WebdriverIO.Browser, 'dummyCommand');
      expect(switchToWindowMock).toHaveBeenCalled();
      expect(browser.electron.windowHandle).toBe('window1');
    });

    it('should maintain focus when staying on same window', async () => {
      const { browser, switchToWindowMock } = getBrowser('browser1', 'currentWindow');
      await ensureActiveWindowFocus(browser as unknown as WebdriverIO.Browser, 'dummyCommand');
      expect(switchToWindowMock).not.toHaveBeenCalled();
      expect(browser.electron.windowHandle).toBe('currentWindow');
    });

    describe('MultiRemote', () => {
      it('should switch focus to new windows in all browser instances', async () => {
        const { browser: browser1, switchToWindowMock: switchToWindowMock1 } = getBrowser('browser1');
        const { browser: browser2, switchToWindowMock: switchToWindowMock2 } = getBrowser('browser2');
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
        const { browser: browser1, switchToWindowMock: switchToWindowMock1 } = getBrowser('browser1', 'currentWindow');
        const { browser: browser2, switchToWindowMock: switchToWindowMock2 } = getBrowser('browser2', 'currentWindow');
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
