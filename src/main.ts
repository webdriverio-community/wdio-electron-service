import electron, { App, app, BrowserWindow, dialog, Dialog, ipcMain } from 'electron';

type AppFunction = (this: App, ...args: unknown[]) => unknown;
type MainProcessFunction = (this: NodeJS.Process, ...args: unknown[]) => unknown;
type BrowserWindowFunction = (this: BrowserWindow, ...args: unknown[]) => unknown;

let showMessageBoxResponse = { response: 1, checkboxChecked: true };

dialog.showMessageBox = ((
  browserWindow: BrowserWindow,
  { message }: Electron.MessageBoxOptions,
): Promise<Electron.MessageBoxReturnValue> => Promise.resolve(showMessageBoxResponse)) as Dialog['showMessageBox'];

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

ipcMain.handle('wdio-electron.dialog', (_event, funcName: string, ...args: unknown[]) => {
  const dialogProp = dialog[funcName as keyof Dialog];
  if (typeof dialogProp === 'function') {
    return (dialogProp as AppFunction).apply(app, args);
  }
  return dialogProp;
});

ipcMain.handle('wdio-electron.mainProcess', (_event, funcName: string, ...args: unknown[]) => {
  const processProp = process[funcName as keyof NodeJS.Process];
  if (typeof processProp === 'function') {
    return (processProp as MainProcessFunction).apply(process, args);
  }
  return processProp;
});

ipcMain.handle('wdio-electron.mock', (_event, apiName: string, funcName: string, mockReturnValue: unknown) => {
  const electronApi = electron[apiName as keyof typeof electron];
  const electronApiFunc = electronApi[funcName as keyof typeof electronApi];
  if (typeof electronApiFunc !== 'function') {
    throw new Error(`Unable to find function ${funcName} on ${apiName} module.`);
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  electron[apiName][funcName] = funcName.endsWith('Sync')
    ? () => mockReturnValue
    : () => Promise.resolve(mockReturnValue);

  return {
    apiName,
    funcName,
    mockReturnValue,
  };
});
