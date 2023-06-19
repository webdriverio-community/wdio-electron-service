import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { IpcMainInvokeEvent } from 'electron';

type MockObj = { [Key: string]: unknown };

const electronAppMock: MockObj = {};
const electronBrowserWindowMock: MockObj = {};
const electronDialogMock: MockObj = {};
const fromWebContentsMock = vi.fn().mockReturnValue(electronBrowserWindowMock);
const ipcMainHandleMock = vi.fn();

vi.mock('electron', () => ({
  app: electronAppMock,
  BrowserWindow: { fromWebContents: fromWebContentsMock },
  dialog: electronDialogMock,
  ipcMain: { handle: ipcMainHandleMock },
  default: {
    app: electronAppMock,
    BrowserWindow: { fromWebContents: fromWebContentsMock },
    dialog: electronDialogMock,
    ipcMain: { handle: ipcMainHandleMock },
  },
}));

describe('main', () => {
  let listeners: { [Key: string]: (event: IpcMainInvokeEvent, funcName: string, ...args: unknown[]) => unknown } = {};

  beforeEach(async () => {
    ipcMainHandleMock.mockImplementation((channel: string, listener: () => void) => {
      listeners[channel] = listener;
    });
    await import('../src/main');
  });

  afterEach(() => {
    vi.resetModules();
    listeners = {};
  });

  it('should call ipcMain.handle with the expected parameters', () => {
    expect(ipcMainHandleMock.mock.calls).toEqual([
      ['wdio-electron.app', expect.any(Function)],
      ['wdio-electron.browserWindow', expect.any(Function)],
      ['wdio-electron.dialog', expect.any(Function)],
      ['wdio-electron.mainProcess', expect.any(Function)],
      ['wdio-electron.mock', expect.any(Function)],
    ]);
  });

  describe('app', () => {
    it('should return app properties', () => {
      electronAppMock.test = 'test result';
      const result = listeners['wdio-electron.app']({} as IpcMainInvokeEvent, 'test');
      expect(result).toBe('test result');
    });

    it('should call app functions with the expected parameters and return the result', () => {
      const mockAppFunction = vi.fn().mockReturnValue('test result');
      electronAppMock.test = mockAppFunction;
      const result = listeners['wdio-electron.app']({} as IpcMainInvokeEvent, 'test', 'some', 'args');
      expect(mockAppFunction).toHaveBeenCalledWith('some', 'args');
      expect(result).toBe('test result');
    });
  });

  describe('browserWindow', () => {
    it('should get the browserWindow object from the event sender webContents', () => {
      listeners['wdio-electron.browserWindow']({ sender: 'test-sender' } as unknown as IpcMainInvokeEvent, 'test');
      expect(fromWebContentsMock).toHaveBeenCalledWith('test-sender');
    });

    it('should return browserWindow properties', () => {
      electronBrowserWindowMock.test = 'test result';
      const result = listeners['wdio-electron.browserWindow']({} as IpcMainInvokeEvent, 'test');
      expect(result).toBe('test result');
    });

    it('should call app functions with the expected parameters and return the result', () => {
      const mockBrowserWindowFunction = vi.fn().mockReturnValue('test result');
      electronBrowserWindowMock.test = mockBrowserWindowFunction;
      const result = listeners['wdio-electron.browserWindow']({} as IpcMainInvokeEvent, 'test', 'some', 'args');
      expect(mockBrowserWindowFunction).toHaveBeenCalledWith('some', 'args');
      expect(result).toBe('test result');
    });
  });

  describe('dialog', () => {
    it('should return dialog properties', () => {
      electronDialogMock.test = 'test result';
      const result = listeners['wdio-electron.dialog']({} as IpcMainInvokeEvent, 'test');
      expect(result).toBe('test result');
    });

    it('should call dialog functions with the expected parameters and return the result', () => {
      const mockDialogFunction = vi.fn().mockReturnValue('test result');
      electronDialogMock.test = mockDialogFunction;
      const result = listeners['wdio-electron.dialog']({} as IpcMainInvokeEvent, 'test', 'some', 'args');
      expect(mockDialogFunction).toHaveBeenCalledWith('some', 'args');
      expect(result).toBe('test result');
    });
  });

  describe('mainProcess', () => {
    it('should return process properties', () => {
      (process as Partial<{ test: string }>).test = 'test result';
      const result = listeners['wdio-electron.mainProcess']({} as IpcMainInvokeEvent, 'test');
      expect(result).toBe('test result');
    });

    it('should call process functions with the expected parameters and return the result', () => {
      const mockProcessFunction = vi.fn().mockReturnValue('test result');
      (process as Partial<{ test: () => void }>).test = mockProcessFunction;
      const result = listeners['wdio-electron.mainProcess']({} as IpcMainInvokeEvent, 'test', 'some', 'args');
      expect(mockProcessFunction).toHaveBeenCalledWith('some', 'args');
      expect(result).toBe('test result');
    });
  });

  describe('mock', () => {
    it('should throw an error when the function to mock does not exist', () => {
      expect(() => {
        listeners['wdio-electron.mock']({} as IpcMainInvokeEvent, 'dialog', 'testFn', 'test result');
      }).toThrow('Unable to find function testFn on dialog module.');
    });

    it('should mock the value of a synchronous function', () => {
      electronDialogMock.testFnSync = () => 'unmocked result';
      listeners['wdio-electron.mock']({} as IpcMainInvokeEvent, 'dialog', 'testFnSync', 'test result');
      const result = listeners['wdio-electron.dialog']({} as IpcMainInvokeEvent, 'testFnSync', 'some', 'args');
      expect(result).toBe('test result');
    });

    it('should mock the value of an asynchronous function', async () => {
      electronDialogMock.testFn = () => 'unmocked result';
      listeners['wdio-electron.mock']({} as IpcMainInvokeEvent, 'dialog', 'testFn', 'test result');
      const result = await listeners['wdio-electron.dialog']({} as IpcMainInvokeEvent, 'testFn', 'some', 'args');
      expect(result).toBe('test result');
    });
  });
});
