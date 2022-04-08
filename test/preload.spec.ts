import type { WdioElectronWindowObj } from '../src/@types/wdio-electron';

const ipcRendererInvokeMock = jest.fn();

jest.mock('electron', () => ({
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
    await import('../src/preload');
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
