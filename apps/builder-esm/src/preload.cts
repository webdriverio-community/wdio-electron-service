import { contextBridge, ipcRenderer } from 'electron';

async function init() {
  const { isTest } = await import('./util.js');

  if (isTest) {
    import('wdio-electron-service/preload');
  }

  const validChannels = ['increase-window-size', 'decrease-window-size'];

  const invoke = (channel: string, ...data: unknown[]) =>
    validChannels.includes(channel) ? ipcRenderer.invoke(channel, data) : Promise.reject();

  contextBridge.exposeInMainWorld('api', {
    invoke,
  });
}

init();
