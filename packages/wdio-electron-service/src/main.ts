// TODO: This file should be remove at V9
import { ipcMain } from 'electron';

import { Channel } from './constants.js';

ipcMain.handle(Channel.Execute, (_event: Electron.IpcMainInvokeEvent) => {
  return true;
});
