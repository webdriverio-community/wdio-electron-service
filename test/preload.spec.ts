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
    process.env.WDIO_ELECTRON = 'true';
    await import('../src/preload.js');
  });

  it('should throw an error when the WDIO_ELECTRON environment variable does not exist', async () => {
    delete process.env.WDIO_ELECTRON;
    await expect(window.wdioElectron.execute('look', ['some', 'args'])).rejects.toThrow(
      'Electron APIs can not be invoked outside of WDIO',
    );
    expect(ipcRendererInvokeMock).not.toHaveBeenCalled();
  });

  it('should call invoke with the expected params', async () => {
    await window.wdioElectron.execute('look', ['some', 'args']);
    const ipcChannelName = 'wdio-electron.execute';
    expect(ipcRendererInvokeMock).toHaveBeenCalledWith(ipcChannelName, 'look', ['some', 'args']);
  });
});
