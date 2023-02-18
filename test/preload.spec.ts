import { vi, describe, beforeEach, it, expect } from 'vitest';

import type { WdioElectronWindowObj } from '../@types/wdio-electron-service';

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
    await import('../src/preload');
  });

  it('should throw an error when the WDIO_ELECTRON environment variable does not exist', async () => {
    delete process.env.WDIO_ELECTRON;
    await expect(
      (window.wdioElectron as WdioElectronWindowObj).mainProcess.invoke('look', 'some', 'args'),
    ).rejects.toThrow('Electron APIs can not be invoked outside of WDIO');
    expect(ipcRendererInvokeMock).not.toHaveBeenCalled();
  });

  const apis = ['custom', 'mainProcess', 'app', 'browserWindow'];

  apis.forEach((apiName) => {
    describe(`${apiName} api`, () => {
      it('should call invoke with the expected params', async () => {
        await (window.wdioElectron as WdioElectronWindowObj)[apiName as keyof WdioElectronWindowObj].invoke(
          'look',
          'some',
          'args',
        );
        const ipcChannelName = apiName === 'custom' ? 'wdio-electron' : `wdio-electron.${apiName}`;
        expect(ipcRendererInvokeMock).toHaveBeenCalledWith(ipcChannelName, ['look', 'some', 'args']);
      });
    });
  });
});
