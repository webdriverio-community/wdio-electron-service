import { fn as vitestFn } from '@vitest/spy';
import { browser as wdioBrowser } from '@wdio/globals';
import type { PackageJson } from 'read-package-up';

import { init as initSession } from './session.mjs';
import { CJSElectronLauncher, CJSElectronService } from './classes.mjs';
import type {
  ElectronInterface,
  ElectronServiceAPI,
  ElectronServiceOptions,
  ElectronType,
  WdioElectronWindowObj,
} from '@repo/types';

exports.default = CJSElectronService;
exports.launcher = CJSElectronLauncher;

interface BrowserExtension {
  /**
   * Access the WebdriverIO Electron Service API.
   *
   * - {@link ElectronServiceAPI.clearAllMocks `browser.electron.clearAllMocks`} - Clear mock functions from the Electron API
   * - {@link ElectronServiceAPI.execute `browser.electron.execute`} - Execute code in the Electron main process context
   * - {@link ElectronServiceAPI.mock `browser.electron.mock`} - Mock a function from the Electron API, e.g. `dialog.showOpenDialog`
   * - {@link ElectronServiceAPI.mockAll `browser.electron.mockAll`} - Mock an entire API object of the Electron API, e.g. `app` or `dialog`
   * - {@link ElectronServiceAPI.resetAllMocks `browser.electron.resetAllMocks`} - Reset mock functions from the Electron API
   * - {@link ElectronServiceAPI.restoreAllMocks `browser.electron.restoreAllMocks`} - Remove mock functions from the Electron API
   */
  electron: ElectronServiceAPI;
}

declare global {
  interface Window {
    wdioElectron: WdioElectronWindowObj;
  }
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
  var originalApi: Record<ElectronInterface, ElectronType[ElectronInterface]>;
  var packageJson: PackageJson;
}

export const browser: WebdriverIO.Browser = wdioBrowser;
export const startElectron: (opts: ElectronServiceOptions) => Promise<WebdriverIO.Browser> = initSession;
