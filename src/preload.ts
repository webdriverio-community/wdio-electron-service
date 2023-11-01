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
  app: {
    invoke: (funcName: string, ...args: unknown[]) => invoke(Channel.App, funcName, ...args),
  },
  browserWindow: {
    invoke: (funcName: string, ...args: unknown[]) => invoke(Channel.BrowserWindow, funcName, ...args),
  },
  custom: {
    invoke: (...args: unknown[]) => invoke(Channel.Custom, ...args),
  },
  dialog: {
    invoke: (funcName: string, ...args: unknown[]) => invoke(Channel.Dialog, funcName, ...args),
  },
  mainProcess: {
    invoke: (funcName: string, ...args: unknown[]) => invoke(Channel.MainProcess, funcName, ...args),
  },
  mock: {
    invoke: (apiName: string, funcName: string, mockReturnValue: unknown) =>
      invoke(Channel.Mock, apiName, funcName, mockReturnValue),
  },
  execute: (script: string, args: unknown[]) => invoke(Channel.Execute, script, args),
});
