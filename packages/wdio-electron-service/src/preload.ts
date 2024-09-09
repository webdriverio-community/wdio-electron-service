import { contextBridge, ipcRenderer } from 'electron';
import { Channel } from './constants.js';

const invoke = async (channel: Channel, ...data: unknown[]) => ipcRenderer.invoke(channel, ...data);

contextBridge.exposeInMainWorld('wdioElectron', {
  execute: (script: string, args: unknown[]) => invoke(Channel.Execute, script, args),
});

contextBridge.exposeInMainWorld('__name', (func: (...args: unknown[]) => unknown) => func);
