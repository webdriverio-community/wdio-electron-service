import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getActiveWindowHandle, ensureActiveWindowFocus } from '../src/window.js';
import type { ElectronServiceAPI } from '@wdio/electron-types';

vi.mock('@wdio/electron-utils/log', () => ({
  default: {
    trace: vi.fn(),
    debug: vi.fn(),
  },
}));

type MockBrowser = Omit<WebdriverIO.Browser, 'isMultiremote'> & {
  isMultiremote: boolean;
  getWindowHandles: ReturnType<typeof vi.fn>;
  switchToWindow: ReturnType<typeof vi.fn>;
  electron: Partial<ElectronServiceAPI> & {
    windowHandle: string | undefined;
  };
};

describe('getWindowHandle', () => {
  describe('when no window', () => {
    it('should return undefined when no windows are available', async () => {
      const browser = {
        isMultiremote: false,
        getWindowHandles: vi.fn().mockResolvedValue([]),
        electron: {
          windowHandle: undefined,
        },
      } as unknown as WebdriverIO.Browser;

      const handle = await getActiveWindowHandle(browser);
      expect(handle).toBe(undefined);
    });
  });

  describe('when 1 window', () => {
    it('should return the active window handle', async () => {
      const browser = {
        isMultiremote: false,
        getWindowHandles: vi.fn().mockResolvedValue(['window-1']),
        electron: {
          windowHandle: undefined,
        },
      } as unknown as WebdriverIO.Browser;

      const handle = await getActiveWindowHandle(browser);
      expect(handle).toBe('window-1');
    });
  });

  describe('when 2 or more windows', () => {
    it('should return the current window handle when active', async () => {
      const browser = {
        isMultiremote: false,
        getWindowHandles: vi.fn().mockResolvedValue(['window-1', 'window-2']),
        electron: {
          windowHandle: 'window-2',
        },
      } as unknown as WebdriverIO.Browser;

      const handle = await getActiveWindowHandle(browser);
      expect(handle).toBe('window-2');
    });

    it('should fallback to the first window handle when current is invalid', async () => {
      const browser = {
        isMultiremote: false,
        getWindowHandles: vi.fn().mockResolvedValue(['window-1', 'window-2']),
        electron: {
          windowHandle: 'invalid-window',
        },
      } as unknown as WebdriverIO.Browser;

      const handle = await getActiveWindowHandle(browser);
      expect(handle).toBe('window-1');
    });
  });

  it('should return undefined when using MultiRemote', async () => {
    const browser = {
      isMultiremote: true,
      getWindowHandles: vi.fn().mockResolvedValue(['window1', 'window2']),
    } as unknown as WebdriverIO.Browser;

    const handle = await getActiveWindowHandle(browser as unknown as WebdriverIO.Browser);
    expect(handle).toBe(undefined);
  });
});

describe('ensureActiveWindowFocus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should switch focus to the new window when it becomes active', async () => {
    const getWindowHandlesMock = vi.fn().mockResolvedValue(['window1']);
    const switchToWindowMock = vi.fn();
    const browser = {
      isMultiremote: false,
      electron: {
        windowHandle: 'currentWindow',
      },
      getWindowHandles: getWindowHandlesMock,
      switchToWindow: switchToWindowMock,
    } as unknown as WebdriverIO.Browser;
    await ensureActiveWindowFocus(browser as unknown as WebdriverIO.Browser, 'dummyCommand');
    expect(switchToWindowMock).toHaveBeenCalled();
    expect(browser.electron.windowHandle).toBe('window1');
  });

  it('should maintain focus when staying on same window', async () => {
    const getWindowHandlesMock = vi.fn().mockResolvedValue(['currentWindow']);
    const switchToWindowMock = vi.fn();
    const browser = {
      isMultiremote: false,
      electron: {
        windowHandle: 'currentWindow',
      },
      getWindowHandles: getWindowHandlesMock,
      switchToWindow: switchToWindowMock,
    } as unknown as WebdriverIO.Browser;
    await ensureActiveWindowFocus(browser as unknown as WebdriverIO.Browser, 'dummyCommand');
    expect(switchToWindowMock).not.toHaveBeenCalled();
    expect(browser.electron.windowHandle).toBe('currentWindow');
  });

  describe('MultiRemote', () => {
    const getBrowser = (newWindow = 'window1', current = 'currentWindow') => {
      const getWindowHandlesMock = vi.fn().mockResolvedValue([newWindow]);
      const switchToWindowMock = vi.fn();
      const browser = {
        isMultiremote: false,
        electron: {
          windowHandle: current,
          execute: vi.fn(),
        },
        getWindowHandles: getWindowHandlesMock,
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

describe('Window Management', () => {
  let browser: MockBrowser;

  beforeEach(() => {
    browser = {
      isMultiremote: false,
      getWindowHandles: vi.fn().mockResolvedValue([]),
      switchToWindow: vi.fn().mockResolvedValue(undefined),
      electron: {
        windowHandle: undefined,
      },
    } as MockBrowser;

    vi.clearAllMocks();
  });

  describe('getActiveWindowHandle', () => {
    it('should return undefined for multiremote', async () => {
      browser.isMultiremote = true;
      const result = await getActiveWindowHandle(browser as unknown as WebdriverIO.Browser);
      expect(result).toBeUndefined();
    });

    it('should return undefined when no windows exist', async () => {
      browser.getWindowHandles.mockResolvedValue([]);
      const result = await getActiveWindowHandle(browser as unknown as WebdriverIO.Browser);
      expect(result).toBeUndefined();
    });

    it('should return the current handle if valid', async () => {
      const currentHandle = 'window1';
      browser.electron.windowHandle = currentHandle;
      browser.getWindowHandles.mockResolvedValue(['window1', 'window2']);

      const result = await getActiveWindowHandle(browser as unknown as WebdriverIO.Browser);
      expect(result).toBe(currentHandle);
    });

    it('should return the first handle if the current handle is invalid', async () => {
      browser.electron.windowHandle = 'invalid';
      browser.getWindowHandles.mockResolvedValue(['window1', 'window2']);

      const result = await getActiveWindowHandle(browser as unknown as WebdriverIO.Browser);
      expect(result).toBe('window1');
    });
  });

  describe('ensureActiveWindowFocus', () => {
    it('should handle multiremote browser instances', async () => {
      const mrBrowser = {
        isMultiremote: true,
        instances: ['instance1', 'instance2'],
        getInstance: vi.fn(),
      } as any;

      const instance = {
        ...browser,
        isMultiremote: false,
      };
      mrBrowser.getInstance.mockReturnValue(instance);

      await ensureActiveWindowFocus(mrBrowser as unknown as WebdriverIO.Browser, 'test');
      expect(mrBrowser.getInstance).toHaveBeenCalledTimes(2);
    });

    it('should switch the window when the handle changes', async () => {
      browser.getWindowHandles.mockResolvedValue(['window1']);
      browser.electron.windowHandle = 'old-window';

      await ensureActiveWindowFocus(browser as unknown as WebdriverIO.Browser, 'test');

      expect(browser.switchToWindow).toHaveBeenCalledWith('window1');
      expect(browser.electron.windowHandle).toBe('window1');
    });

    it('should not switch the window when the handle has not changed', async () => {
      const currentHandle = 'window1';
      browser.electron.windowHandle = currentHandle;
      browser.getWindowHandles.mockResolvedValue([currentHandle]);

      await ensureActiveWindowFocus(browser as unknown as WebdriverIO.Browser, 'test');

      expect(browser.switchToWindow).not.toHaveBeenCalled();
    });
  });
});
