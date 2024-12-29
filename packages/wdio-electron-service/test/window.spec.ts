import { vi, describe, it, expect } from 'vitest';
import { executeWindowManagement, getWindowHandle } from '../src/window.js';

describe('getWindowHandle', () => {
  it('should return the window handle', async () => {
    const browser = {
      isMultiremote: false,
      getWindowHandles: vi.fn().mockResolvedValue(['window1']),
    } as unknown as WebdriverIO.Browser;

    const handle = await getWindowHandle(browser);
    expect(handle).toBe('window1');
  });
  it('should not return the window handle when over 2 windows', async () => {
    const browser = {
      isMultiremote: false,
      getWindowHandles: vi.fn().mockResolvedValue(['window1', 'window2']),
    } as unknown as WebdriverIO.Browser;

    const handle = await getWindowHandle(browser);
    expect(handle).toBe(undefined);
  });
  it('should not return the window handle when MultiRemote', async () => {
    const browser = {
      isMultiremote: true,
      getWindowHandles: vi.fn().mockResolvedValue(['window1', 'window2']),
    } as unknown as WebdriverIO.Browser;

    const handle = await getWindowHandle(browser);
    expect(handle).toBe(undefined);
  });
});

describe('executeWindowManagement', () => {
  it.each(['getWindowHandle', 'getWindowHandles', 'switchToWindow'])(
    'should not execute when the command: %s',
    async (command) => {
      const mock = vi.fn().mockResolvedValue(['window1']);
      const browser = {
        isMultiremote: false,
        getWindowHandles: mock,
      } as unknown as WebdriverIO.Browser;

      await executeWindowManagement(browser, command);
      expect(mock).not.toHaveBeenCalled();
    },
  );

  it('should call `switchToWindow` when window is changed', async () => {
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
    await executeWindowManagement(browser, 'dummyCommand');
    expect(switchToWindowMock).toHaveBeenCalled();
    expect(browser.electron.windowHandle).toBe('window1');
  });

  it('should not call `switchToWindow` when window is changed', async () => {
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
    await executeWindowManagement(browser, 'dummyCommand');
    expect(switchToWindowMock).not.toHaveBeenCalled();
    expect(browser.electron.windowHandle).toBe('currentWindow');
  });

  describe('MultiRemote', async () => {
    const getBrowser = (newWindow = 'window1', current = 'currentWindow') => {
      const getWindowHandlesMock = vi.fn().mockResolvedValue([newWindow]);
      const switchToWindowMock = vi.fn();
      const browser = {
        isMultiremote: false,
        electron: {
          windowHandle: current,
        },
        getWindowHandles: getWindowHandlesMock,
        switchToWindow: switchToWindowMock,
      } as unknown as WebdriverIO.Browser;

      return { browser, switchToWindowMock };
    };

    it('should call `switchToWindow` when window is changed', async () => {
      const { browser: browser1, switchToWindowMock: switchToWindowMock1 } = getBrowser();
      const { browser: browser2, switchToWindowMock: switchToWindowMock2 } = getBrowser();
      const browser = {
        isMultiremote: true,
        instances: ['browser1', 'browser2'],
        getInstance: (instance: string) => (instance === 'browser1' ? browser1 : browser2),
      } as unknown as WebdriverIO.MultiRemoteBrowser;

      await executeWindowManagement(browser, 'dummyCommand');
      expect(switchToWindowMock1).toHaveBeenCalled();
      expect(switchToWindowMock2).toHaveBeenCalled();
    });

    it('should not call `switchToWindow` when window is changed', async () => {
      const { browser: browser1, switchToWindowMock: switchToWindowMock1 } = getBrowser('currentWindow');
      const { browser: browser2, switchToWindowMock: switchToWindowMock2 } = getBrowser('currentWindow');
      const browser = {
        isMultiremote: true,
        instances: ['browser1', 'browser2'],
        getInstance: (instance: string) => (instance === 'browser1' ? browser1 : browser2),
      } as unknown as WebdriverIO.MultiRemoteBrowser;

      await executeWindowManagement(browser, 'dummyCommand');
      expect(switchToWindowMock1).not.toHaveBeenCalled();
      expect(switchToWindowMock2).not.toHaveBeenCalled();
    });
  });
});
