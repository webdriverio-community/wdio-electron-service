import { contextBridge, ipcRenderer } from 'electron';

(async () => {
  // util.js is an ESM module so we need to use dynamic import
  const { isTest } = await import('./util.js');

  if (isTest) {
    require('wdio-electron-service/preload');
  }

  const validChannels = ['increase-window-size', 'decrease-window-size'];

  const invoke = (channel: string, ...data: unknown[]) =>
    validChannels.includes(channel) ? ipcRenderer.invoke(channel, data) : Promise.reject();

  contextBridge.exposeInMainWorld('api', {
    invoke,
  });
})();
