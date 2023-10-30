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
export type ElectronServiceApi = Record<string, { value: (...args: unknown[]) => Promise<unknown> }>;

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
