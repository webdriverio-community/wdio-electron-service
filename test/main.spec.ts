import { vi, beforeEach, afterEach, it, expect } from 'vitest';
import { IpcMainInvokeEvent } from 'electron';

const ipcMain = {
  handle: vi.fn(),
};
const app = {
  getName: () => 'test',
};
const electronMock = {
  ipcMain,
  app,
  default: { ipcMain, app },
};

vi.mock('electron', () => electronMock);

let listeners: { [Key: string]: (event: IpcMainInvokeEvent, funcName: string, ...args: unknown[]) => unknown } = {};

beforeEach(async () => {
  ipcMain.handle.mockImplementation((channel: string, listener: () => void) => {
    listeners[channel] = listener;
  });
  await import('../src/main');
});

afterEach(() => {
  vi.resetModules();
  listeners = {};
});

it('should call ipcMain.handle with the expected parameters', () => {
  expect(ipcMain.handle.mock.calls).toEqual([['wdio-electron.execute', expect.any(Function)]]);
});

it('should execute a script', () => {
  expect(
    ipcMain.handle.mock.calls[0][1](
      undefined,
      (electron: typeof electronMock, a: number, b: number, c: number) => electron.app.getName() + a + b + c,
      [1, 2, 3],
    ),
  ).toBe('test123');
});
