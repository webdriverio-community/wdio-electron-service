const { contextBridge, ipcRenderer } = require('electron');

// TODO: Start: This section should be removed at V9
const isIpcBridgeEnabled = Boolean(process.env.ENABLE_IPC_BRIDGE);

if (isIpcBridgeEnabled) {
  require('wdio-electron-service/preload');
}
// TODO: End: This section should be removed at V9

const validChannels = ['increase-window-size', 'decrease-window-size', 'show-open-dialog', 'switch-main-window'];

const invoke = (channel: string, ...data: unknown[]) =>
  validChannels.includes(channel) ? ipcRenderer.invoke(channel, data) : Promise.reject();

contextBridge.exposeInMainWorld('api', {
  invoke,
});
