import electron, { App, app, BrowserWindow, ipcMain } from 'electron';

type AppFunction = (this: App, ...args: unknown[]) => unknown;
type MainProcessFunction = (this: NodeJS.Process, ...args: unknown[]) => unknown;
type BrowserWindowFunction = (this: BrowserWindow, ...args: unknown[]) => unknown;

ipcMain.handle('wdio-electron.mock', (_event, apiName: string, funcName: string, value: unknown) => {
  const electronApi = electron[apiName as keyof typeof electron];
  const electronApiFunc = electronApi[funcName as keyof typeof electronApi];
  if (!electronApiFunc) {
    throw new Error(`Can't find ${funcName} on ${apiName} module.`);
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  electron[apiName][funcName] = funcName.endsWith('Sync') ? () => value : () => Promise.resolve(value);

  return true;
});

// ipcMain.handle('wdio-electron.mockDialog', (_event, funcName: string, value: DialogFunctionReturnValue) => {
//   const dialogProp = dialog[funcName as keyof Electron.Dialog];
//   if (!dialogProp) {
//     throw new Error(`Can't find ${funcName} on dialog module.`);
//   }
//   (dialog[funcName as keyof typeof dialog] as typeof dialogProp) = funcName.endsWith('Sync')
//     ? () => value
//     : () => Promise.resolve(value);

//   return true;
// });

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

ipcMain.handle('wdio-electron.browserWindow', (event, funcName: string, ...args: unknown[]) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender) as BrowserWindow;
  const browserWindowProp = browserWindow[funcName as keyof BrowserWindow];
  if (typeof browserWindowProp === 'function') {
    return (browserWindowProp as BrowserWindowFunction).apply(browserWindow, args);
  }
  return browserWindowProp;
});
