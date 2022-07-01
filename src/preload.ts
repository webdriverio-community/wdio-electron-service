import { contextBridge, ipcRenderer } from 'electron';

const validChannels = [
  'wdio-electron',
  'wdio-electron.app',
  'wdio-electron.mainProcess',
  'wdio-electron.browserWindow',
];

const invoke = async (channel: string, ...data: unknown[]) => {
  if (!validChannels.includes(channel)) {
    throw new Error(`Channel "${channel}" is invalid`);
  }
  if (!process.env.WDIO_ELECTRON && !process.env.WDIO_WORKER) {
    throw new Error('Electron APIs can not be invoked outside of WDIO');
  }
  return ipcRenderer.invoke(channel, data);
};

contextBridge.exposeInMainWorld('wdioElectron', {
  custom: {
    invoke: (...args: unknown[]) => invoke('wdio-electron', ...args),
  },
  mainProcess: {
    invoke: (funcName: string, ...args: unknown[]) => invoke('wdio-electron.mainProcess', funcName, ...args),
  },
  app: {
    invoke: (funcName: string, ...args: unknown[]) => invoke('wdio-electron.app', funcName, ...args),
  },
  browserWindow: {
    invoke: (funcName: string, ...args: unknown[]) => invoke('wdio-electron.browserWindow', funcName, ...args),
  },
});
