// TODO: This file should be remove at V9
import { contextBridge, ipcRenderer } from 'electron';
import { Channel } from './constants.js';

const invoke = async (channel: Channel, ...data: unknown[]) => ipcRenderer.invoke(channel, ...data);

// Expose `execute` to the renderer process
contextBridge.exposeInMainWorld('wdioElectron', {
  execute: (script: string, args: unknown[]) => invoke(Channel.Execute, script, args),
});
