import { App, app, ipcMain } from 'electron';

type AppFunction = (this: App, ...args: unknown[]) => unknown;
type MainProcessFunction = (this: NodeJS.Process, ...args: unknown[]) => unknown;

ipcMain.handle('wdio-electron.mainProcess', (_event, funcName: string, ...args: unknown[]) => {
  const processProp = process[funcName as keyof NodeJS.Process];
  if (typeof processProp === 'function') {
    return (processProp as MainProcessFunction).apply(process, args);
  }
  return processProp;
});

ipcMain.handle('wdio-electron.app', (_event, funcName: string, ...args: unknown[]) => {
  const appProp = app[funcName as keyof App];
  if (typeof appProp === 'function') {
    return (appProp as AppFunction).apply(app, args);
  }
  return appProp;
});
