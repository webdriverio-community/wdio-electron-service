import type * as Electron from 'electron';
import type { Mock } from '@vitest/spy';

/**
 * set this environment variable so that the preload script can be loaded
 */
process.env.WDIO_ELECTRON = 'true';

export type Fn = (...args: unknown[]) => unknown;
export type AsyncFn = (...args: unknown[]) => Promise<unknown>;
export type AbstractFn = Fn | AsyncFn;
export type ElectronApiFn = ElectronType[ElectronInterface][keyof ElectronType[ElectronInterface]];

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
   * expect(showOpenDialog).toHaveBeenCalledTimes(1);
   * expect(showOpenDialog).toHaveBeenCalledWith({
   *   properties: ['openFile', 'openDirectory'],
   * });
   * ```
   */
  mock: <Interface extends ElectronInterface>(
    apiName: Interface,
    funcName?: string,
    returnValue?: unknown,
  ) => Promise<ElectronMock>;
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
  mockAll: <Interface extends ElectronInterface>(apiName: Interface) => Promise<Record<string, ElectronMock>>;
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
   * Clear mocked Electron API function(s)
   *
   * @example
   * ```js
   * // clears all mocked functions
   * await browser.electron.clearAllMocks()
   * // clears all mocked functions of dialog API
   * await browser.electron.clearAllMocks('dialog')
   * ```
   *
   * @param apiName mocked api to clear
   */
  clearAllMocks: (apiName?: string) => Promise<void>;
  /**
   * Reset mocked Electron API function(s)
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
   * Restore mocked Electron API function(s)
   *
   * @example
   * ```js
   * // restores all mocked functions
   * await browser.electron.restoreAllMocks()
   * // restores all mocked functions of dialog API
   * await browser.electron.restoreAllMocks('dialog')
   * ```
   *
   * @param apiName mocked api to remove
   */
  restoreAllMocks: (apiName?: string) => Promise<void>;
}

/**
 * The options for the Electron Service.
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
   * Calls .mockClear() on all mocked APIs before each test. This will clear mock history, but not reset its implementation.
   */
  clearMocks?: boolean;
  /**
   * Calls .mockReset() on all mocked APIs before each test. This will clear mock history and reset its implementation to an empty function (will return undefined).
   */
  resetMocks?: boolean;
  /**
   * Calls .mockRestore() on all mocked APIs before each test. This will restore the original API function, the mock will be removed.
   */
  restoreMocks?: boolean;
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
  execute: (script: string, args?: unknown[]) => unknown;
};

type Override =
  | 'mockImplementation'
  | 'mockImplementationOnce'
  | 'mockReturnValue'
  | 'mockReturnValueOnce'
  | 'mockClear'
  | 'mockReset';
type NotImplemented =
  | 'mockResolvedValue'
  | 'mockResolvedValueOnce'
  | 'mockRejectedValue'
  | 'mockRejectedValueOnce'
  | 'withImplementation';

interface ElectronMockInstance extends Omit<Mock, Override | NotImplemented> {
  /**
   * Accepts a function that will be used as an implementation of the mock.
   *
   * @example
   * ```js
   * const mockGetName = await browser.electron.mock('app', 'getName');
   * let callsCount = 0;
   * await mockGetName.mockImplementation(() => {
   *   // callsCount is not accessible in the electron context so we need to guard it
   *   if (typeof callsCount !== 'undefined') {
   *     callsCount++;
   *   }
   *   return 'mocked value';
   * });
   *
   * const result = await browser.electron.execute(async (electron) => await electron.app.getName());
   * expect(callsCount).toBe(1);
   * expect(result).toBe('mocked value');
   * ```
   */
  mockImplementation(fn: AbstractFn): Promise<ElectronMock>;
  /**
   * Accepts a function that will be used as mock's implementation during the next call. If chained, every consecutive call will produce different results.
   *
   * When the mocked function runs out of implementations, it will invoke the default implementation set with `mockImplementation`.
   *
   * @example
   * ```js
   *  const mockGetName = await browser.electron.mock('app', 'getName')
   *  await mockGetName.mockImplementationOnce(() => 'first mock');
   *  await mockGetName.mockImplementationOnce(() => 'second mock');
   *
   *  let name = await browser.electron.execute((electron) => electron.app.getName());
   *  expect(name).toBe('first mock');
   *  name = await browser.electron.execute((electron) => electron.app.getName());
   *  expect(name).toBe('second mock');
   *  name = await browser.electron.execute((electron) => electron.app.getName());
   *  expect(name).toBeNull();
   * ```
   */
  mockImplementationOnce(fn: AbstractFn): Promise<ElectronMock>;
  /**
   * Accepts a value that will be returned whenever the mock function is called.
   *
   * @example
   * ```js
   *  const mockGetName = await browser.electron.mock('app', 'getName')
   *  await mockGetName.mockReturnValue('mocked name');
   *
   *  const name = await browser.electron.execute((electron) => electron.app.getName());
   *  expect(name).toBe('mocked name');
   * ```
   */
  mockReturnValue(obj: unknown): Promise<ElectronMock>;
  /**
   * Accepts a value that will be returned during the next function call. If chained, every consecutive call will return the specified value.
   *
   * When there are no more `mockReturnValueOnce` values to use, the mock will fall back to the previously defined implementation if there is one.
   *
   * @example
   * ```js
   *  const mockGetName = await browser.electron.mock('app', 'getName')
   *  await mockGetName.mockReturnValueOnce('first mock');
   *  await mockGetName.mockReturnValueOnce('second mock');
   *
   *  let name = await browser.electron.execute((electron) => electron.app.getName());
   *  expect(name).toBe('first mock');
   *  name = await browser.electron.execute((electron) => electron.app.getName());
   *  expect(name).toBe('second mock');
   *  name = await browser.electron.execute((electron) => electron.app.getName());
   *  expect(name).toBeNull();
   * ```
   */
  mockReturnValueOnce(obj: unknown): Promise<ElectronMock>;
  /**
   * Clears the history of the mocked Electron API function. The mock implementation will not be reset.
   *
   * @example
   * ```js
   *  const mockGetName = await browser.electron.mock('app', 'getName')
   *  await browser.electron.execute((electron) => electron.app.getName());
   *
   *  await mockGetName.mockClear();
   *
   *  await browser.electron.execute((electron) => electron.app.getName());
   *  expect(mockGetName).toHaveBeenCalledTimes(1);
   * ```
   */
  mockClear(): Promise<ElectronMock>;
  /**
   * Resets the mocked Electron API function. The mock history will be cleared and the implementation will be reset to an empty function (returning `undefined`).
   *
   * This also resets all "once" implementations.
   *
   * @example
   * ```js
   *  const mockGetName = await browser.electron.mock('app', 'getName')
   *  await mockGetName.mockReturnValue('mocked name');
   *  await browser.electron.execute((electron) => electron.app.getName());
   *
   *  await mockGetName.mockReset();
   *
   *  const name = await browser.electron.execute((electron) => electron.app.getName());
   *  expect(name).toBeUndefined();
   *  expect(mockGetName).toHaveBeenCalledTimes(1);
   * ```
   */
  mockReset(): Promise<ElectronMock>;
  /**
   * Restores the original implementation to the Electron API function.
   *
   * @example
   * ```js
   *  const appName = await browser.electron.execute((electron) => electron.app.getName());
   *  const mockGetName = await browser.electron.mock('app', 'getName')
   *  await mockGetName.mockReturnValue('mocked name');
   *
   *  await mockGetName.mockRestore();
   *
   *  const name = await browser.electron.execute((electron) => electron.app.getName());
   *  expect(name).toBe(appName);
   * ```
   */
  mockRestore(): Promise<ElectronMock>;
  /**
   * Used internally to update the outer mock function with calls from the inner (Electron context) mock.
   */
  update(): Promise<ElectronMock>;
  /**
   * Used internally to determine whether the mock function is being updated.
   */
  updating: boolean;
}

export interface ElectronMock<TArgs extends any[] = any, TReturns = any> extends ElectronMockInstance {
  new (...args: TArgs): TReturns;
  (...args: TArgs): TReturns;
}
