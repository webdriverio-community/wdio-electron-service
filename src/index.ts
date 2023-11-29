import { browser as wdioBrowser } from '@wdio/globals';
import { fn as vitestFn } from '@vitest/spy';
import type * as Electron from 'electron';

import ElectronLaunchService from './launcher.js';
import ElectronWorkerService from './service.js';
import type { ElectronServiceMock } from './commands/mock.js';
import type { ElectronServiceOptions } from './types.js';

/**
 * set this environment variable so that the preload script can be loaded
 */
process.env.WDIO_ELECTRON = 'true';

export const launcher = ElectronLaunchService;
export default ElectronWorkerService;

type ElectronType = typeof Electron;
type ElectronInterface = keyof ElectronType;
type MockedFn = {
  mockImplementation: (fn: () => void) => void;
  mockReturnValue: (returnValue: unknown) => void;
};
type MockedApi = {
  [K: string]: MockedFn;
} & {
  getMock: (funcName?: string) => Promise<void>;
  setMock: (funcName?: string, mockImplementation?: () => void, mockReturnValue?: unknown) => Promise<void>;
  unMock: (funcName?: string) => Promise<void>;
};

interface ElectronServiceAPI {
  /**
   * Used internally for storing mock objects
   */
  _mocks: Record<string, ElectronServiceMock>;
  /**
   * Call a custom handler within the Electron process.
   * @param args arbitrary arguments to pass to the handler
   * @returns a {@link Promise} that resolves once the handler was triggered
   *
   * @example
   * ```js
   * // in your Electron main process file
   * const { ipcMain } = require('electron');
   * ipcMain.handle('wdio-electron', (event, ...args) => {
   *   // ...
   *   return 'some result';
   * });
   *
   * // in your test file
   * const result = await browser.electron.api()
   * console.log(result) // 'some result'
   * ```
   */
  api: (...args: unknown[]) => Promise<unknown>;
  /**
   * Access the Electron {@link https://www.electronjs.org/docs/latest/api/app app} API and call function through the command.
   * @param funcName name of the function from the `app` interface
   * @param arg      arguments to pass to the function
   * @returns a {@link Promise} that resolves to the return value of the function
   *
   * @example
   * ```js
   * // get the app's name
   * const appName = await browser.electron.app('getName');
   * // 'My App'
   * console.log(appName)
   * ```
   */
  app: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
  /**
   * Access the Electron {@link https://www.electronjs.org/docs/latest/api/browser-window browserWindow} API and call function through the command.
   * @param funcName name of the function from the `browserWindow` interface
   * @param arg      arguments to pass to the function
   * @returns a {@link Promise} that resolves to the return value of the function
   *
   * @example
   * ```js
   * // get the current window's bounds
   * const bounds = await browser.electron.browserWindow('getBounds');
   * // { x: 440, y: 225, width: 100, height: 600 }
   * console.log(bounds)
   * ```
   */
  browserWindow: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
  /**
   * Access the Electron {@link https://www.electronjs.org/docs/latest/api/dialog dialog} API and call function through the command.
   * @param funcName name of the function from the `dialog` interface
   * @param arg      arguments to pass to the function
   * @returns a {@link Promise} that resolves to the return value of the function
   *
   * @example
   * ```js
   * // show a message box
   * await browser.electron.dialog('showMessageBox', {
   *   type: 'info',
   *   buttons: ['Ok'],
   *   message: 'Hello World',
   * });
   * ```
   */
  dialog: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
  /**
   * Access the Electron {@link https://www.electronjs.org/docs/latest/api/process process} API and call function through the command.
   * @param funcName name of the function from the `mainProcess` interface
   * @param arg      arguments to pass to the function
   * @returns a {@link Promise} that resolves to the return value of the function
   *
   * @example
   * ```js
   * // get the current process's pid
   * const pid = await browser.electron.mainProcess('getProcessId');
   * // 1234
   * console.log(pid)
   * ```
   */
  mainProcess: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
  /**
   * Mock a function from the Electron API.
   * @param apiName name of the API to mock
   * @param funcName name of the function to mock
   * @param mockReturnValue value to return when the mocked function is called
   * @returns a {@link Promise} that resolves once the mock is registered
   *
   * @example
   * ```js
   * // mock the app's getName function
   * await browser.electron.mock('dialog', 'showOpenDialog', 'I opened a dialog!');
   * const result = await browser.electron.dialog('showOpenDialog');
   * expect(result).toEqual('I opened a dialog!');
   * ```
   */
  mock: <Interface extends ElectronInterface>(apiName: Interface, funcName?: string) => Promise<MockedApi>;
  /**
   * Execute a function within the Electron main process.
   *
   * @example
   * ```js
   * await browser.electron.execute((electron, param1, param2, param3) => {
   *   const appWindow = electron.BrowserWindow.getFocusedWindow();
   *   electron.dialog.showMessageBox(appWindow, {
   *     message: 'Hello World!',
   *     detail: `${param1} + ${param2} + ${param3} = ${param1 + param2 + param3}`
   *   });
   * }, 1, 2, 3)
   * ```
   *
   * @param script function to execute
   * @param args function arguments
   */
  execute<ReturnValue, InnerArguments extends unknown[]>(
    script: string | ((electron: typeof Electron, ...innerArgs: InnerArguments) => ReturnValue),
    ...args: InnerArguments
  ): Promise<ReturnValue>;
  /**
   * Remove mocked function(s)
   *
   * @example
   * ```js
   * // clears all mocked functions
   * await browser.electron.removeMocks()
   * // clears all mocked functions of dialog API
   * await browser.electron.removeMocks('dialog')
   * ```
   *
   * @param apiName mocked api to clear
   */
  removeMocks: (apiName?: string) => Promise<void>;
}

export interface BrowserExtension {
  /**
   * Access the WebdriverIO Electron Service API.
   *
   * - {@link ElectronServiceAPI.api `browser.electron.api`} - Call a custom handler within the Electron process.
   * - {@link ElectronServiceAPI.app `browser.electron.app`} - Access the Electron {@link https://www.electronjs.org/docs/latest/api/app app} API and call function through the command.
   * - {@link ElectronServiceAPI.browserWindow `browser.electron.browserWindow`} - Access the Electron {@link https://www.electronjs.org/docs/latest/api/browser-window browserWindow} API and call function through the command.
   * - {@link ElectronServiceAPI.dialog `browser.electron.dialog`} - Access the Electron {@link https://www.electronjs.org/docs/latest/api/dialog dialog} API and call function through the command.
   * - {@link ElectronServiceAPI.mainProcess `browser.electron.mainProcess`} - Access the Electron {@link https://www.electronjs.org/docs/latest/api/process process} API and call function through the command.
   * - {@link ElectronServiceAPI.mock `browser.electron.mock`} - Mock a function from the Electron API.
   */
  electron: ElectronServiceAPI;
}

declare global {
  namespace WebdriverIO {
    interface Browser extends BrowserExtension {}
    interface MultiRemoteBrowser extends BrowserExtension {}
    interface Capabilities {
      /**
       * custom capabilities to configure the Electron service
       */
      'wdio:electronServiceOptions'?: ElectronServiceOptions;
    }
  }

  var browser: WebdriverIO.Browser;
  var fn: typeof vitestFn;
}

export const browser: WebdriverIO.Browser = wdioBrowser;
export * from './types.js';
