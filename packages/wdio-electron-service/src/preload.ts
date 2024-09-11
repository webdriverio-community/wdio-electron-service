import { contextBridge, ipcRenderer } from 'electron';
import { Channel } from './constants.js';

const invoke = async (channel: Channel, ...data: unknown[]) => ipcRenderer.invoke(channel, ...data);

// Expose `execute` to the renderer process
contextBridge.exposeInMainWorld('wdioElectron', {
  execute: (script: string, args: unknown[]) => invoke(Channel.Execute, script, args),
});

// Expose __name to the renderer process to work around issue with function serialization
// https://github.com/privatenumber/tsx/issues/113
contextBridge.exposeInMainWorld('__name', (func: (...args: unknown[]) => unknown) => func);
