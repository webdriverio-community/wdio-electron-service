const { contextBridge, ipcRenderer } = require('electron');

const validChannels = ['increase-window-size', 'decrease-window-size', 'show-open-dialog', 'switch-main-window'];

const invoke = (channel: string, ...data: unknown[]) =>
  validChannels.includes(channel) ? ipcRenderer.invoke(channel, data) : Promise.reject();

contextBridge.exposeInMainWorld('api', {
  invoke,
});
