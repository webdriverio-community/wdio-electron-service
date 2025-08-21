import type { OfficialArch } from '@electron/packager';
import type { ForgeConfig as ElectronForgeConfig } from '@electron-forge/shared-types';
import type { Mock, fn as vitestFn } from '@vitest/spy';
import type { Capabilities, Options } from '@wdio/types';
import type { ArchType } from 'builder-util';
import type * as Electron from 'electron';
import type { PackageJson } from 'read-package-up';

import type { ChainablePromiseArray, ChainablePromiseElement } from 'webdriverio';

export type Fn = (...args: unknown[]) => unknown;
export type AsyncFn = (...args: unknown[]) => Promise<unknown>;
export type AbstractFn = Fn | AsyncFn;
export type ElectronApiFn = ElectronType[ElectronInterface][keyof ElectronType[ElectronInterface]];

export interface ElectronServiceAPI {
  /**
   * The window handle of the Electron window.
   */
  windowHandle?: string;
  /**
   * Mock a function from the Electron API.
   *
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
   *
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
   * Clear mocked Electron API function(s).
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
   * Reset mocked Electron API function(s).
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
   * Restore mocked Electron API function(s).
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
  /**
   * Checks that a given parameter is an Electron mock function. If you are using TypeScript, it will also narrow down its type.
   *
   * @example
   * ```js
   * const mockGetName = await browser.electron.mock('app', 'getName');
   *
   * expect(browser.electron.isMockFunction(mockGetName)).toBe(true);
   * ```
   */
  isMockFunction: (fn: unknown) => fn is ElectronMockInstance;
}

/**
 * The options for the Electron Service.
 */
export interface ElectronServiceOptions {
  /**
   * An array of string arguments to be passed through to the app on execution of the test run.
   * Electron [command line switches](https://www.electronjs.org/docs/latest/api/command-line-switches)
   * and some [Chromium switches](https://peter.sh/experiments/chromium-command-line-switches) can be
   * used here.
   */
  appArgs?: string[];
  /**
   * The path to the electron binary of the app for testing.
   */
  appBinaryPath?: string;
  /**
   * The path to the electron entry point of the app for testing.
   */
  appEntryPoint?: string;
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

export type ElectronServiceGlobalOptions = Pick<
  ElectronServiceOptions,
  'clearMocks' | 'resetMocks' | 'restoreMocks'
> & {
  rootDir?: string;
  /**
   * Timeout for any request using CdpBridge to a node debugger.
   */
  cdpBridgeTimeout?: number;
  /**
   * Interval in milliseconds to wait between attempts to connect to the node debugger.
   */
  cdpBridgeWaitInterval?: number;
  /**
   * Number of attempts to connect to the node debugger before giving up.
   */
  cdpBridgeRetryCount?: number;
  /**
   * Control automatic installation of AppArmor profiles on Linux if needed.
   * When false, the service will warn and continue without installing.
   * @default false
   * - false (default): never install; warn and continue without AppArmor profile
   * - true: install only if running as root (no sudo)
   * - 'sudo': install if root or via non-interactive sudo (`sudo -n`) if available
   */
  apparmorAutoInstall?: boolean | 'sudo';
};

export type ApiCommand = { name: string; bridgeProp: string };
export type WebdriverClientFunc = (this: WebdriverIO.Browser, ...args: unknown[]) => Promise<unknown>;

export type ElectronType = typeof Electron;
export type ElectronInterface = keyof ElectronType;

export type BuilderConfig = {
  productName?: string;
  directories?: { output?: string };
  executableName?: string;
};

export type ForgeConfig = ElectronForgeConfig;

export type BuilderArch = ArchType;
export type ForgeArch = OfficialArch;

export type ForgeBuildInfo = {
  appName: string;
  config: ForgeConfig;
  isBuilder: false;
  isForge: true;
};

export type BuilderBuildInfo = {
  appName: string;
  config: BuilderConfig;
  isBuilder: true;
  isForge: false;
};

export type AppBuildInfo = ForgeBuildInfo | BuilderBuildInfo;

// Binary Path Result Types
export type PathGenerationErrorType =
  | 'CONFIG_MISSING'
  | 'CONFIG_INVALID'
  | 'CONFIG_WARNING'
  | 'MULTIPLE_BUILD_TOOLS'
  | 'NO_BUILD_TOOL'
  | 'UNSUPPORTED_PLATFORM';

export type PathValidationErrorType =
  | 'FILE_NOT_FOUND'
  | 'NOT_EXECUTABLE'
  | 'PERMISSION_DENIED'
  | 'IS_DIRECTORY'
  | 'ACCESS_ERROR';

export interface PathGenerationError {
  type: PathGenerationErrorType;
  message: string;
  buildTool?: string;
  details?: string;
}

export interface PathValidationError {
  type: PathValidationErrorType;
  message: string;
  code?: string;
  permissions?: string;
  details?: string;
}

export interface PathValidationAttempt {
  path: string;
  valid: boolean;
  error?: PathValidationError;
}

export interface PathGenerationResult {
  success: boolean;
  paths: string[];
  errors: PathGenerationError[];
}

export interface PathValidationResult {
  success: boolean;
  validPath?: string;
  attempts: PathValidationAttempt[];
}

export interface BinaryPathResult {
  success: boolean;
  binaryPath?: string;
  pathGeneration: PathGenerationResult;
  pathValidation: PathValidationResult;
}

export type ExecuteOpts = {
  internal?: boolean;
};

export type WdioElectronWindowObj = {
  execute: (script: string, args?: unknown[]) => unknown;
};

enum ElectronMockResultType {
  Return = 'return',
  Throw = 'throw',
}

type ElectronMockResult = {
  type: ElectronMockResultType;
  value: unknown;
};

interface ElectronMockContext {
  /**
   * This is an array containing all arguments for each call. Each item of the array is the arguments of that call.
   *
   * @example
   * ```js
   * const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');
   *
   * await browser.electron.execute((electron) => electron.app.getFileIcon('/path/to/icon'));
   * await browser.electron.execute((electron) => electron.app.getFileIcon('/path/to/another/icon', { size: 'small' }));
   *
   * expect(mockGetFileIcon.mock.calls).toStrictEqual([
   *   ['/path/to/icon'], // first call
   *   ['/path/to/another/icon', { size: 'small' }], // second call
   * ]);
   * ```
   */
  calls: unknown[][];
  /**
   * The order of mock invocation. This returns an array of numbers that are shared between all defined mocks. Will return an empty array if the mock was never invoked.
   *
   * @example
   * ```js
   * const mockGetName = await browser.electron.mock('app', 'getName');
   * const mockGetVersion = await browser.electron.mock('app', 'getVersion');
   *
   * await browser.electron.execute((electron) => electron.app.getName());
   * await browser.electron.execute((electron) => electron.app.getVersion());
   * await browser.electron.execute((electron) => electron.app.getName());
   *
   * expect(mockGetName.mock.invocationCallOrder).toStrictEqual([1, 3]);
   * expect(mockGetVersion.mock.invocationCallOrder).toStrictEqual([2]);
   * ```
   */
  invocationCallOrder: number[];
  /**
   * This is an array containing all values that were returned from the mock. Each item of the array is an object with the properties type and value. Available types are:
   *
   *     'return' - the mock returned without throwing.
   *     'throw' - the mock threw a value.
   *
   * The value property contains the returned value or the thrown error. If the mock returned a promise, the value will be the resolved value, not the Promise itself, unless it was never resolved.
   *
   * @example
   * ```js
   * const mockGetName = await browser.electron.mock('app', 'getName');
   *
   * await mockGetName.mockImplementationOnce(() => 'result');
   * await mockGetName.mockImplementation(() => {
   *   throw new Error('thrown error');
   * });
   *
   * await expect(browser.electron.execute((electron) => electron.app.getName())).resolves.toBe('result');
   * await expect(browser.electron.execute((electron) => electron.app.getName())).rejects.toThrow('thrown error');
   *
   * expect(mockGetName.mock.results).toStrictEqual([
   *   {
   *     type: 'return',
   *     value: 'result',
   *   },
   *   {
   *     type: 'throw',
   *     value: new Error('thrown error'),
   *   },
   * ]);
   * ```
   */
  results: ElectronMockResult[];
  /**
   * This contains the arguments of the last call. If the mock wasn't called, it will return `undefined`.
   *
   * @example
   * ```js
   * const mockSetName = await browser.electron.mock('app', 'setName');
   *
   * await browser.electron.execute((electron) => electron.app.setName('test'));
   * expect(mockSetName.mock.lastCall).toStrictEqual(['test']);
   * await browser.electron.execute((electron) => electron.app.setName('test 2'));
   * expect(mockSetName.mock.lastCall).toStrictEqual(['test 2']);
   * await browser.electron.execute((electron) => electron.app.setName('test 3'));
   * expect(mockSetName.mock.lastCall).toStrictEqual(['test 3']);
   * ```
   */
  lastCall: unknown;
}

type Override =
  | 'mockImplementation'
  | 'mockImplementationOnce'
  | 'mockReturnValue'
  | 'mockReturnValueOnce'
  | 'mockResolvedValue'
  | 'mockResolvedValueOnce'
  | 'mockRejectedValue'
  | 'mockRejectedValueOnce'
  | 'mockClear'
  | 'mockReset'
  | 'mockReturnThis'
  | 'mockName'
  | 'withImplementation'
  | 'mock';

export interface ElectronMockInstance extends Omit<Mock, Override> {
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
   * const name = await browser.electron.execute(async (electron) => await electron.app.getName());
   * expect(callsCount).toBe(1);
   * expect(name).toBe('mocked value');
   * ```
   */
  mockImplementation(fn: AbstractFn): Promise<ElectronMock>;
  /**
   * Accepts a function that will be used as the mock's implementation during the next call. If chained, every consecutive call will produce different results.
   *
   * When the mocked function runs out of implementations, it will invoke the default implementation set with `mockImplementation`.
   *
   * @example
   * ```js
   *  const mockGetName = await browser.electron.mock('app', 'getName');
   *  await mockGetName.mockImplementation(() => 'default mock');
   *  await mockGetName.mockImplementationOnce(() => 'first mock');
   *  await mockGetName.mockImplementationOnce(() => 'second mock');
   *
   *  let name = await browser.electron.execute((electron) => electron.app.getName());
   *  expect(name).toBe('first mock');
   *  name = await browser.electron.execute((electron) => electron.app.getName());
   *  expect(name).toBe('second mock');
   *  name = await browser.electron.execute((electron) => electron.app.getName());
   *  expect(name).toBe('default mock');
   * ```
   */
  mockImplementationOnce(fn: AbstractFn): Promise<ElectronMock>;
  /**
   * Accepts a value that will be returned whenever the mock function is called.
   *
   * @example
   * ```js
   *  const mockGetName = await browser.electron.mock('app', 'getName');
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
   *  await mockGetName.mockReturnValue('default mock');
   *  await mockGetName.mockReturnValueOnce('first mock');
   *  await mockGetName.mockReturnValueOnce('second mock');
   *
   *  let name = await browser.electron.execute((electron) => electron.app.getName());
   *  expect(name).toBe('first mock');
   *  name = await browser.electron.execute((electron) => electron.app.getName());
   *  expect(name).toBe('second mock');
   *  name = await browser.electron.execute((electron) => electron.app.getName());
   *  expect(name).toBe('default mock');
   * ```
   */
  mockReturnValueOnce(obj: unknown): Promise<ElectronMock>;
  /**
   * Accepts a value that will be resolved when an async function is called.
   *
   * @example
   * ```js
   *  const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');
   *  await mockGetFileIcon.mockResolvedValue('This is a mock');
   *
   *  const fileIcon = await browser.electron.execute(
   *    async (electron) => await electron.app.getFileIcon('/path/to/icon'),
   *  );
   *
   *  expect(fileIcon).toBe('This is a mock');
   * ```
   */
  mockResolvedValue(obj: unknown): Promise<ElectronMock>;
  /**
   * Accepts a value that will be resolved during the next function call. If chained, every consecutive call will resolve the specified value.
   *
   * @example
   * ```js
   *  const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');
   *  await mockGetFileIcon.mockResolvedValue('default mock')
   *  await mockGetFileIcon.mockResolvedValueOnce('first mock');
   *  await mockGetFileIcon.mockResolvedValueOnce('second mock');
   *
   *  let fileIcon = await browser.electron.execute(
   *    async (electron) => await electron.app.getFileIcon('/path/to/icon'),
   *  );
   *  expect(fileIcon).toBe('first mock');
   *  fileIcon = await browser.electron.execute(
   *    async (electron) => await electron.app.getFileIcon('/path/to/icon'),
   *  );
   *  expect(fileIcon).toBe('second mock');
   *  fileIcon = await browser.electron.execute(
   *    async (electron) => await electron.app.getFileIcon('/path/to/icon'),
   *  );
   *  expect(fileIcon).toBe('default mock');
   * ```
   */
  mockResolvedValueOnce(obj: unknown): Promise<ElectronMock>;
  /**
   * Accepts a value that will be rejected when an async function is called.
   *
   * @example
   * ```js
   *  const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');
   *  await mockGetFileIcon.mockRejectedValue('This is a mock error');
   *
   *  const fileIconError = await browser.electron.execute(async (electron) => {
   *    try {
   *      await electron.app.getFileIcon('/path/to/icon');
   *    } catch (e) {
   *      return e;
   *    }
   *  });
   *
   *  expect(fileIconError).toBe('This is a mock error');
   * ```
   */
  mockRejectedValue(obj: unknown): Promise<ElectronMock>;
  /**
   * Accepts a value that will be rejected during the next function call. If chained, every consecutive call will resolve the specified value.
   *
   * @example
   * ```js
   *  const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');
   *  await mockGetFileIcon.mockRejectedValue('default mocked icon error')
   *  await mockGetFileIcon.mockRejectedValueOnce('first mocked icon error');
   *  await mockGetFileIcon.mockRejectedValueOnce('second mocked icon error');
   *
   *  const getFileIcon = async () =>
   *    await browser.electron.execute(async (electron) => {
   *      try {
   *        await electron.app.getFileIcon('/path/to/icon');
   *      } catch (e) {
   *        return e;
   *      }
   *    });
   *
   *  let fileIcon = await getFileIcon();
   *  expect(fileIcon).toBe('first mocked icon error');
   *  fileIcon = await getFileIcon();
   *  expect(fileIcon).toBe('second mocked icon error');
   *  fileIcon = await getFileIcon();
   *  expect(fileIcon).toBe('default mocked icon error');
   * ```
   */
  mockRejectedValueOnce(obj: unknown): Promise<ElectronMock>;
  /**
   * Clears the history of the mocked Electron API function. The mock implementation will not be reset.
   *
   * @example
   * ```js
   *  const mockGetName = await browser.electron.mock('app', 'getName');
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
   *  const mockGetName = await browser.electron.mock('app', 'getName');
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
   *  const mockGetName = await browser.electron.mock('app', 'getName');
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
   * Useful if you need to return the `this` context from the method without invoking implementation. This is a shorthand for:
   *
   * ```js
   *  await spy.mockImplementation(function () {
   *    return this;
   *  });
   * ```
   *
   * ...which enables API functions to be chained:
   *
   * @example
   * ```js
   *  const mockGetName = await browser.electron.mock('app', 'getName');
   *  const mockGetVersion = await browser.electron.mock('app', 'getVersion');
   *  await mockGetName.mockReturnThis();
   *  await browser.electron.execute((electron) =>
   *    electron.app.getName().getVersion()
   *  );
   *
   *  expect(mockGetVersion).toHaveBeenCalled();
   * ```
   */
  mockReturnThis(): Promise<unknown>;
  /**
   * Overrides the original mock implementation temporarily while the callback is being executed.
   * The electron object is passed into the callback in the same way as for `execute`.
   *
   * @example
   * ```js
   *  const mockGetName = await browser.electron.mock('app', 'getName');
   *  const withImplementationResult = await mockGetName.withImplementation(
   *    () => 'temporary mock name',
   *    (electron) => electron.app.getName(),
   *  );
   *
   *  expect(withImplementationResult).toBe('temporary mock name');
   * ```
   *
   * It can also be used with an asynchronous callback:
   *
   * @example
   * ```js
   *  const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');
   *  const withImplementationResult = await mockGetFileIcon.withImplementation(
   *    () => Promise.resolve('temporary mock icon'),
   *    async (electron) => await electron.app.getFileIcon('/path/to/icon'),
   *  );
   *
   *  expect(withImplementationResult).toBe('temporary mock icon');
   * ```
   *
   */
  withImplementation<ReturnValue, InnerArguments extends unknown[]>(
    implFn: AbstractFn,
    callbackFn: (electron: typeof Electron, ...innerArgs: InnerArguments) => ReturnValue,
  ): Promise<unknown>;
  /**
   * Assigns a name to the mock. Useful to see the name of the mock if an assertion fails.
   * The name can be retrieved via `getMockName`.
   *
   * @example
   * ```js
   * const mockGetName = await browser.electron.mock('app', 'getName');
   * mockGetName.mockName('test mock');
   *
   * expect(mockGetName.getMockName()).toBe('test mock');
   * ```
   */
  mockName(name: string): ElectronMock;
  /**
   * Returns the assigned name of the mock. Defaults to `electron.<apiName>.<funcName>`.
   *
   * @example
   * ```js
   * const mockGetName = await browser.electron.mock('app', 'getName');
   *
   * expect(mockGetName.getMockName()).toBe('electron.app.getName');
   * ```
   */
  getMockName(): string;
  /**
   * Returns the current mock implementation.  The default implementation is an empty function (returns `undefined`).
   *
   * @example
   * ```js
   *  const mockGetName = await browser.electron.mock('app', 'getName');
   *  await mockGetName.mockImplementation(() => 'mocked name');
   *  const mockImpl = mockGetName.getMockImplementation();
   *
   *  expect(mockImpl()).toBe('mocked name');
   * ```
   */
  getMockImplementation(): AbstractFn;
  /**
   * Used internally to update the outer mock function with calls from the inner (Electron context) mock.
   *
   * @private
   */
  update(): Promise<ElectronMock>;
  /**
   * Current context of the mock. It stores information about all invocation calls and results.
   */
  mock: ElectronMockContext;
  /**
   * Used internally to distinguish the electron mock from other mocks.
   *
   * @private
   */
  __isElectronMock: boolean;
}

export interface ElectronMock<TArgs extends unknown[] = unknown[], TReturns = unknown> extends ElectronMockInstance {
  new (...args: TArgs): TReturns;
  (...args: TArgs): TReturns;
}

type $ = (selector: unknown) => ChainablePromiseElement;
type $$ = (selector: unknown) => ChainablePromiseArray;

type SelectorsBase = {
  $: $;
  $$: $$;
};
type BaseWithExecute = {
  execute<T>(script: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T>;
  execute<T>(script: string | ((...args: unknown[]) => T), ...args: unknown[]): T;
  executeAsync(script: string | ((...args: unknown[]) => void), ...args: unknown[]): unknown;
};
type ElementBase = SelectorsBase & {
  parent: ElementBase | BaseWithExecute;
};
type BrowserBase = SelectorsBase & {
  addCommand<T extends boolean>(
    queryName: string,
    commandFn: (this: T extends true ? ElementBase : BrowserBase, ...args: unknown[]) => void,
    isElementCommand?: T,
  ): unknown;
};

export interface BrowserExtension extends BrowserBase {
  /**
   * Access the WebdriverIO Electron Service API.
   *
   * - {@link ElectronServiceAPI.clearAllMocks `browser.electron.clearAllMocks`} - Clear the Electron API mock functions
   * - {@link ElectronServiceAPI.execute `browser.electron.execute`} - Execute code in the Electron main process context
   * - {@link ElectronServiceAPI.mock `browser.electron.mock`} - Mock a function from the Electron API, e.g. `dialog.showOpenDialog`
   * - {@link ElectronServiceAPI.mockAll `browser.electron.mockAll`} - Mock an entire API object of the Electron API, e.g. `app` or `dialog`
   * - {@link ElectronServiceAPI.resetAllMocks `browser.electron.resetAllMocks`} - Reset the Electron API mock functions
   * - {@link ElectronServiceAPI.restoreAllMocks `browser.electron.restoreAllMocks`} - Restore the original Electron API functionality
   * - {@link ElectronServiceAPI.windowHandle `browser.electron.windowHandle`} - Get the current window handle
   */
  electron: ElectronServiceAPI;
}

type ElectronServiceCustomCapability = {
  /**
   * custom capabilities to configure the Electron service
   */
  'wdio:electronServiceOptions'?: ElectronServiceOptions;
};

type ElectronServiceRequestedStandaloneCapabilities = Capabilities.RequestedStandaloneCapabilities &
  ElectronServiceCustomCapability;
type ElectronServiceRequestedMultiremoteCapabilities = Capabilities.RequestedMultiremoteCapabilities &
  ElectronServiceCustomCapability;

export type ElectronServiceCapabilities =
  | ElectronServiceRequestedStandaloneCapabilities[]
  | ElectronServiceRequestedMultiremoteCapabilities
  | ElectronServiceRequestedMultiremoteCapabilities[];

export type WdioElectronConfig = Options.Testrunner & {
  capabilities: ElectronServiceCapabilities | ElectronServiceCapabilities[];
};

declare global {
  interface Window {
    wdioElectron: WdioElectronWindowObj;
  }

  // biome-ignore lint/style/noNamespace: This is a legitimate use of namespace for global augmentation
  namespace WebdriverIO {
    interface Browser extends BrowserExtension {}
    interface Element extends ElementBase {}
    interface MultiRemoteBrowser extends BrowserExtension {}
    interface Capabilities extends ElectronServiceCustomCapability {}
    interface ServiceOption extends ElectronServiceGlobalOptions {}
  }

  var __name: (func: Fn) => Fn;
  var browser: WebdriverIO.Browser;
  var fn: typeof vitestFn;
  var originalApi: Record<ElectronInterface, ElectronType[ElectronInterface]>;
  var packageJson: PackageJson;
}
