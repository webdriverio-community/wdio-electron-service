// TODO: This file should be remove at V9
import { vi, describe, beforeEach, it, expect } from 'vitest';

const ipcRendererInvokeMock = vi.fn();

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (apiKey: string, api: unknown) => {
      Object.defineProperty(global, apiKey, {
        value: api,
      });
    },
  },
  ipcRenderer: { invoke: ipcRendererInvokeMock },
}));

describe('Preload Script', () => {
  beforeEach(async () => {
    await import('../src/preload.js');
  });

  it('should call invoke with the expected params', async () => {
    await window.wdioElectron.execute();
    const ipcChannelName = 'wdio-electron.execute';
    expect(ipcRendererInvokeMock).toHaveBeenCalledWith(ipcChannelName);
  });
});
