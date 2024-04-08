import { browser as wdioBrowser } from '@wdio/globals';
import { fn as vitestFn } from '@vitest/spy';
import type { PackageJson } from 'read-package-up';

import ElectronLaunchService from './launcher.js';
import ElectronWorkerService from './service.js';
import type {
  ElectronInterface,
  ElectronServiceAPI,
  ElectronServiceOptions,
  ElectronType,
  WdioElectronWindowObj,
} from './types.js';

export const launcher = ElectronLaunchService;
export default ElectronWorkerService;

export interface BrowserExtension {
  /**
   * Access the WebdriverIO Electron Service API.
   *
   * - {@link ElectronServiceAPI.clearAllMocks `browser.electron.clearAllMocks`} - Clear the Electron API mock functions
   * - {@link ElectronServiceAPI.execute `browser.electron.execute`} - Execute code in the Electron main process context
   * - {@link ElectronServiceAPI.mock `browser.electron.mock`} - Mock a function from the Electron API, e.g. `dialog.showOpenDialog`
   * - {@link ElectronServiceAPI.mockAll `browser.electron.mockAll`} - Mock an entire API object of the Electron API, e.g. `app` or `dialog`
   * - {@link ElectronServiceAPI.resetAllMocks `browser.electron.resetAllMocks`} - Reset the Electron API mock functions
   * - {@link ElectronServiceAPI.restoreAllMocks `browser.electron.restoreAllMocks`} - Restore the original Electron API functionality
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

  var fn: typeof vitestFn;
  var originalApi: Record<ElectronInterface, ElectronType[ElectronInterface]>;
  var browser: WebdriverIO.Browser;
  var packageJson: PackageJson;
}

export const browser: WebdriverIO.Browser = wdioBrowser;
export * from './types.js';
