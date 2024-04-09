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

describe('preload', () => {
  beforeEach(async () => {
    await import('../src/preload.js');
  });

  it('should call invoke with the expected params', async () => {
    await window.wdioElectron.execute('look', ['some', 'args']);
    const ipcChannelName = 'wdio-electron.execute';
    expect(ipcRendererInvokeMock).toHaveBeenCalledWith(ipcChannelName, 'look', ['some', 'args']);
  });
});
