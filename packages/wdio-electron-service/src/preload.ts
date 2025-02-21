// TODO: This file should be remove at V9
import { contextBridge, ipcRenderer } from 'electron';
import { Channel } from './constants.js';

const invoke = async (channel: Channel) => ipcRenderer.invoke(channel);

// Expose `execute` to the renderer process
contextBridge.exposeInMainWorld('wdioElectron', {
  execute: () => invoke(Channel.Execute),
});
