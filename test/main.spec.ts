import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { IpcMainInvokeEvent } from 'electron';

const ipcMainHandleMock = vi.fn();

vi.mock('electron', () => ({
  ipcMain: { handle: ipcMainHandleMock },
  default: {
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
    expect(ipcMainHandleMock.mock.calls).toEqual([['wdio-electron.execute', expect.any(Function)]]);
  });
});
