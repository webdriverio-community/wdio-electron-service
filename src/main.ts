import electron, { app, ipcMain } from 'electron';
import { fn, spyOn } from '@vitest/spy';
import { copyStrict } from 'fast-copy';

import { Channel } from './constants.js';
import { ElectronInterface, ElectronType } from './types.js';

globalThis.fn = fn;
globalThis.spyOn = spyOn;
globalThis.originalApi = {} as unknown as Record<ElectronInterface, ElectronType[ElectronInterface]>;

// store electron API
app.whenReady().then(() => {
  for (const api in electron) {
    const apiName = api as keyof ElectronType;
    globalThis.originalApi[apiName] = {} as ElectronType[ElectronInterface];
    for (const apiElement in electron[apiName]) {
      const apiElementName = apiElement as keyof ElectronType[ElectronInterface];

      globalThis.originalApi[apiName][apiElementName] = copyStrict(electron[apiName][apiElementName]);
    }
  }
});

ipcMain.handle(Channel.Execute, (_, script: string, args: unknown[]) => {
  return new Function(`return (${script}).apply(this, arguments)`)(electron, ...args);
});
