import { contextBridge, ipcRenderer } from 'electron';
import { isTest } from './util';

if (isTest) {
  require('wdio-electron-service/preload');
}

const validChannels = ['increase-window-size', 'decrease-window-size'];

const invoke = (channel: string, ...data: unknown[]) =>
  validChannels.includes(channel) ? ipcRenderer.invoke(channel, data) : Promise.reject();

contextBridge.exposeInMainWorld('api', {
  invoke,
});
