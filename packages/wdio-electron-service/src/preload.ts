import { contextBridge, ipcRenderer } from 'electron';
import { Channel } from './constants.js';

const invoke = async (channel: Channel, ...data: unknown[]) => ipcRenderer.invoke(channel, ...data);

// Expose `execute` to the renderer process
contextBridge.exposeInMainWorld('wdioElectron', {
  execute: (script: string, args: unknown[]) => invoke(Channel.Execute, script, args),
});

// Expose __name to the renderer process to work around issue with function serialization
// This enables browser.electron.execute to work with scripts which declare functions (affects TS specs only)
// https://github.com/webdriverio-community/wdio-electron-service/issues/756
// https://github.com/privatenumber/tsx/issues/113
contextBridge.exposeInMainWorld('__name', (func: (...args: unknown[]) => unknown) => func);
