import type * as Electron from 'electron';

import ElectronLaunchService from './launcher.js';
import ElectronWorkerService from './service.js';
import type { Channel } from './constants.js';
import type { ElectronServiceMock } from './commands/mock.js';

/**
 * set this environment variable so that the preload script can be loaded
 */
process.env.WDIO_ELECTRON = 'true';

export const launcher = ElectronLaunchService;
export default ElectronWorkerService;

type MockFn = (...args: unknown[]) => unknown;
type WrappedMockFn = {
  mockReturnValue: (returnValue: unknown) => Promise<MockFn>;
  mockImplementation: (implementationFn: () => unknown) => Promise<MockFn>;
  update: () => Promise<MockFn>;
  unMock: () => Promise<void>;
} & MockFn;

export interface ElectronServiceAPI {
  /**
   * Used internally for storing mock objects
   */
  _mocks: Record<string, ElectronServiceMock>;
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
  mock: <Interface extends ElectronInterface>(
    apiName: Interface,
    funcName?: string,
    returnValue?: unknown,
  ) => Promise<WrappedMockFn>;
  /**
   * Mock all functions from an Electron API.
   * @param apiName name of the API to mock
   * @returns a {@link Promise} that resolves once the mock is registered
   *
   * @example
   * ```js
   * // mock the app's getName function
   * await browser.electron.mockAll('dialog');
   * const result = await browser.electron.dialog('showOpenDialog');
   * expect(result).toEqual('I opened a dialog!');
   * ```
   */
  mockAll: <Interface extends ElectronInterface>(apiName: Interface) => Promise<Record<string, WrappedMockFn>>;
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

export type ValidChannels = `${Channel}`;
