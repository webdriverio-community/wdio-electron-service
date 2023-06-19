import { contextBridge, ipcRenderer } from 'electron';

const validChannels = [
  'wdio-electron',
  'wdio-electron.app',
  'wdio-electron.browserWindow',
  'wdio-electron.dialog',
  'wdio-electron.mainProcess',
  'wdio-electron.mock',
];

const invoke = async (channel: string, ...data: unknown[]) => {
  if (!validChannels.includes(channel)) {
    throw new Error(`Channel "${channel}" is invalid`);
  }
  if (!process.env.WDIO_ELECTRON) {
    throw new Error('Electron APIs can not be invoked outside of WDIO');
  }
  return ipcRenderer.invoke(channel, ...data);
};

contextBridge.exposeInMainWorld('wdioElectron', {
  app: {
    invoke: (funcName: string, ...args: unknown[]) => invoke('wdio-electron.app', funcName, ...args),
  },
  browserWindow: {
    invoke: (funcName: string, ...args: unknown[]) => invoke('wdio-electron.browserWindow', funcName, ...args),
  },
  custom: {
    invoke: (...args: unknown[]) => invoke('wdio-electron', ...args),
  },
  dialog: {
    invoke: (funcName: string, ...args: unknown[]) => invoke('wdio-electron.dialog', funcName, ...args),
  },
  mainProcess: {
    invoke: (funcName: string, ...args: unknown[]) => invoke('wdio-electron.mainProcess', funcName, ...args),
  },
  mock: {
    invoke: (apiName: string, funcName: string, value: unknown) =>
      invoke('wdio-electron.mock', apiName, funcName, value),
  },
});
