/* eslint global-require: off */
const { contextBridge, ipcRenderer } = require('electron');
const { isTest } = require('./util');

if (isTest) {
  require('wdio-electron-service/preload');
}

const validChannels = ['increase-window-size', 'decrease-window-size'];

const invoke = (channel, ...data) =>
  validChannels.includes(channel) ? ipcRenderer.invoke(channel, data) : Promise.reject();

contextBridge.exposeInMainWorld('api', {
  invoke,
});
