import { contextBridge, ipcRenderer } from 'electron';
const isTest = process.env.TEST === 'true';

if (isTest) {
  require('wdio-electron-service/preload');
}

const validChannels = ['increase-window-size', 'decrease-window-size', 'show-open-dialog', 'switch-main-window'];

const invoke = (channel: string, ...data: unknown[]) =>
  validChannels.includes(channel) ? ipcRenderer.invoke(channel, data) : Promise.reject();

contextBridge.exposeInMainWorld('api', {
  invoke,
});
