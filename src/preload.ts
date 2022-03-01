import { contextBridge, ipcRenderer } from 'electron';

const validChannels = [
  'wdio-electron',
  'wdio-electron.app',
  'wdio-electron.mainProcess',
  'wdio-electron.browserWindow',
];

const invoke = (channel: string, ...data: unknown[]): Promise<unknown> =>
  validChannels.includes(channel)
    ? ipcRenderer.invoke(channel, data)
    : Promise.reject(new Error(`Channel "${channel}" is invalid`));

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
