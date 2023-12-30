import { browser as wdioBrowser } from '@wdio/globals';
import { fn as vitestFn, spyOn as vitestSpyOn } from '@vitest/spy';
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

/**
 * set this environment variable so that the preload script can be loaded
 */
process.env.WDIO_ELECTRON = 'true';

export const launcher = ElectronLaunchService;
export default ElectronWorkerService;

export interface BrowserExtension {
  /**
   * Access the WebdriverIO Electron Service API.
   *
   * - {@link ElectronServiceAPI.execute `browser.electron.execute`} - Execute code in the Electron main process context
   * - {@link ElectronServiceAPI.mock `browser.electron.mock`} - Mock a function from the Electron API, e.g. `dialog.showOpenDialog`
   * - {@link ElectronServiceAPI.mockAll `browser.electron.mockAll`} - Mock an entire API object of the Electron API, e.g. `app` or `dialog`
   * - {@link ElectronServiceAPI.removeMocks `browser.electron.removeMocks`} - Remove mock functions from the Electron API
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
  var spyOn: typeof vitestSpyOn;
  var originalApi: Record<ElectronInterface, ElectronType[ElectronInterface]>;
  var browser: WebdriverIO.Browser;
  var packageJson: PackageJson;
}

export const browser: WebdriverIO.Browser = wdioBrowser;
export * from './types.js';
