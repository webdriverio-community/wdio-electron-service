import electron, { App, app, BrowserWindow, dialog, Dialog, ipcMain } from 'electron';
import { fn } from '@vitest/spy';

import { Channel } from './constants.js';

// @ts-expect-error - missing fn type for global
globalThis.fn = fn;

type AppFunction = (this: App, ...args: unknown[]) => unknown;
type MainProcessFunction = (this: NodeJS.Process, ...args: unknown[]) => unknown;
type BrowserWindowFunction = (this: BrowserWindow, ...args: unknown[]) => unknown;

ipcMain.handle(Channel.App, (_event, funcName: string, ...args: unknown[]) => {
  const appProp = app[funcName as keyof App];
  if (typeof appProp === 'function') {
    return (appProp as AppFunction).apply(app, args);
  }
  return appProp;
});

ipcMain.handle(Channel.BrowserWindow, (event, funcName: string, ...args: unknown[]) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender) as BrowserWindow;
  const browserWindowProp = browserWindow[funcName as keyof BrowserWindow];
  if (typeof browserWindowProp === 'function') {
    return (browserWindowProp as BrowserWindowFunction).apply(browserWindow, args);
  }
  return browserWindowProp;
});

ipcMain.handle(Channel.Dialog, (_event, funcName: string, ...args: unknown[]) => {
  const dialogProp = dialog[funcName as keyof Dialog];
  if (typeof dialogProp === 'function') {
    return (dialogProp as AppFunction).apply(app, args);
  }
  return dialogProp;
});

ipcMain.handle(Channel.Execute, (_, script: string, args: unknown[]) => {
  return new Function(`return (${script}).apply(this, arguments)`)(electron, ...args);
});

ipcMain.handle(Channel.MainProcess, (_event, funcName: string, ...args: unknown[]) => {
  const processProp = process[funcName as keyof NodeJS.Process];
  if (typeof processProp === 'function') {
    return (processProp as MainProcessFunction).apply(process, args);
  }
  return processProp;
});

ipcMain.handle(Channel.Mock, (_event, apiName: string, funcName: string, mockReturnValue: unknown) => {
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
