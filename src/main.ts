import electron, { ipcMain } from 'electron';
import { fn } from '@vitest/spy';

import { Channel } from './constants.js';

globalThis.fn = fn;

ipcMain.handle(Channel.Execute, (_, script: string, args: unknown[]) => {
  return new Function(`return (${script}).apply(this, arguments)`)(electron, ...args);
});
