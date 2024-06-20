import { contextBridge, ipcRenderer } from 'electron';
import { Channel } from '@repo/utils';

const invoke = async (channel: Channel, ...data: unknown[]) => ipcRenderer.invoke(channel, ...data);

contextBridge.exposeInMainWorld('wdioElectron', {
  execute: (script: string, args: unknown[]) => invoke(Channel.Execute, script, args),
});
