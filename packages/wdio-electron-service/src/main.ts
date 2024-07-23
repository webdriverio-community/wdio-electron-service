import electron, { app, ipcMain } from 'electron';
import copy from 'fast-copy';

import { Channel } from './constants.js';
import type { ElectronInterface, ElectronType } from '@wdio-electron/types';

globalThis.originalApi = {} as unknown as Record<ElectronInterface, ElectronType[ElectronInterface]>;

// store electron API
app.whenReady().then(() => {
  for (const api in electron) {
    const apiName = api as keyof ElectronType;
    globalThis.originalApi[apiName] = {} as ElectronType[ElectronInterface];
    for (const apiElement in electron[apiName]) {
      const apiElementName = apiElement as keyof ElectronType[ElectronInterface];

      globalThis.originalApi[apiName][apiElementName] = copy(electron[apiName][apiElementName]);
    }
  }
});

ipcMain.handle(Channel.Execute, (_event: Electron.IpcMainInvokeEvent, script: string, args: unknown[]) => {
  return new Function(`return (${script}).apply(this, arguments)`)(electron, ...args);
});
