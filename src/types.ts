import type * as Electron from 'electron';
import type { AsyncMock } from './mock.js';

/**
 * set this environment variable so that the preload script can be loaded
 */
process.env.WDIO_ELECTRON = 'true';

export type AbstractFn = (...args: unknown[]) => unknown;

export interface ElectronServiceAPI {
  /**
   * Mock a function from the Electron API.
   * @param apiName name of the API to mock
   * @param funcName name of the function to mock
   * @param mockReturnValue value to return when the mocked function is called
   * @returns a {@link Promise} that resolves once the mock is registered
   *
   * @example
   * ```js
   * // mock the dialog API showOpenDialog method
   * const showOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog');
   * await browser.electron.execute(
   *   async (electron) =>
   *     await electron.dialog.showOpenDialog({
   *       properties: ['openFile', 'openDirectory'],
   *     }),
   * );
   *
   * const mockedShowOpenDialog = await showOpenDialog.update();
   * expect(mockedShowOpenDialog).toHaveBeenCalledTimes(1);
   * expect(mockedShowOpenDialog).toHaveBeenCalledWith({
   *   properties: ['openFile', 'openDirectory'],
   * });
   * ```
   */
  mock: <Interface extends ElectronInterface>(
    apiName: Interface,
    funcName?: string,
    returnValue?: unknown,
  ) => Promise<AsyncMock>;
  /**
   * Mock all functions from an Electron API.
   * @param apiName name of the API to mock
   * @returns a {@link Promise} that resolves once the mock is registered
   *
   * @example
   * ```js
   * // mock multiple functions from the app API
   * const app = await browser.electron.mockAll('app');
   * await app.getName.mockReturnValue('mocked-app');
   * await app.getVersion.mockReturnValue('1.0.0-mocked.12');
   * const result = await browser.electron.execute((electron) => `${electron.app.getName()}::${electron.app.getVersion()}`);
   * expect(result).toEqual('mocked-app::1.0.0-mocked.12');
   * ```
   */
  mockAll: <Interface extends ElectronInterface>(apiName: Interface) => Promise<Record<string, AsyncMock>>;
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
   * Reset mocked function(s)
   *
   * @example
   * ```js
   * // resets all mocked functions
   * await browser.electron.resetAllMocks()
   * // resets all mocked functions of dialog API
   * await browser.electron.resetAllMocks('dialog')
   * ```
   *
   * @param apiName mocked api to reset
   */
  resetAllMocks: (apiName?: string) => Promise<void>;
  /**
   * Remove mocked function(s)
   *
   * @example
   * ```js
   * // removes all mocked functions
   * await browser.electron.restoreAllMocks()
   * // removes all mocked functions of dialog API
   * await browser.electron.restoreAllMocks('dialog')
   * ```
   *
   * @param apiName mocked api to remove
   */
  restoreAllMocks: (apiName?: string) => Promise<void>;
}

/**
 * The options for the ElectronService.
 */
export interface ElectronServiceOptions {
  /**
   * The path to the electron binary of the app for testing.
   */
  appBinaryPath?: string;
  /**
   * An array of string arguments to be passed through to the app on execution of the test run.
   * Electron [command line switches](https://www.electronjs.org/docs/latest/api/command-line-switches)
   * and some [Chromium switches](https://peter.sh/experiments/chromium-command-line-switches) can be
   * used here.
   */
  appArgs?: string[];
  /**
   * The browser command used to access the custom electron API.
   * @default api
   */
  customApiBrowserCommand?: string;
}

export type ApiCommand = { name: string; bridgeProp: string };
export type WebdriverClientFunc = (this: WebdriverIO.Browser, ...args: unknown[]) => Promise<unknown>;

export type ElectronType = typeof Electron;
export type ElectronInterface = keyof ElectronType;

export type ElectronBuilderConfig = {
  productName?: string;
  directories?: { output?: string };
};

export type ElectronForgeConfig = {
  buildIdentifier: string;
  packagerConfig: { name: string };
};

export type AppBuildInfo = {
  appName: string;
  config: string | ElectronForgeConfig | ElectronBuilderConfig;
  isBuilder: boolean;
  isForge: boolean;
};

export type WdioElectronWindowObj = {
  execute: (script: string, args: unknown[]) => unknown;
};
