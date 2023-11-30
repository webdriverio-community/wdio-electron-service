import { contextBridge, ipcRenderer } from 'electron';
import { Channel } from './constants.js';

const invoke = async (channel: Channel, ...data: unknown[]) => {
  if (!Object.values(Channel).includes(channel)) {
    throw new Error(`Channel "${channel}" is invalid!`);
  }
  if (!process.env.WDIO_ELECTRON) {
    throw new Error('Electron APIs can not be invoked outside of WDIO');
  }
  return ipcRenderer.invoke(channel, ...data);
};

contextBridge.exposeInMainWorld('wdioElectron', {
  execute: (script: string, args: unknown[]) => invoke(Channel.Execute, script, args),
});
