import { fn as vitestFn, spyOn as vitestSpyOn } from '@vitest/spy';
import { browser as wdioBrowser } from '@wdio/globals';
import type { Capabilities, Services, Options } from '@wdio/types';
import type { PackageJson } from 'read-package-up';

import type {
  ElectronInterface,
  ElectronServiceAPI,
  ElectronServiceOptions,
  ElectronType,
  WdioElectronWindowObj,
} from './types.js';

exports.default = class CJSElectronService {
  private instance?: Promise<Services.ServiceInstance>;

  constructor(options: unknown, caps: never, config: Options.Testrunner) {
    this.instance = (async () => {
      const importPath = '../service.js';
      const { default: ElectronService } = await import(importPath);
      return new ElectronService(options, caps, config);
    })();
  }

  async beforeSession(
    config: Options.Testrunner,
    capabilities: WebdriverIO.Capabilities,
    specs: string[],
    cid: string,
  ) {
    const instance = await this.instance;
    return instance?.beforeSession?.(config, capabilities, specs, cid);
  }

  async before(capabilities: WebdriverIO.Capabilities, specs: string[], browser: WebdriverIO.Browser) {
    const instance = await this.instance;
    return instance?.before?.(capabilities, specs, browser);
  }
};

exports.launcher = class CJSElectronLauncher {
  private instance?: Promise<Services.ServiceInstance>;

  constructor(options: unknown, caps: never, config: Options.Testrunner) {
    this.instance = (async () => {
      const importPath = '../service.js';
      const { default: ElectronService } = await import(importPath);
      return new ElectronService(options, caps, config);
    })();
  }

  async onPrepare(config: Options.Testrunner, capabilities: Capabilities.RemoteCapabilities) {
    const instance = await this.instance;
    return instance?.onPrepare?.(config, capabilities);
  }
};

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
  var spyOn: typeof vitestSpyOn;
  var originalApi: Record<ElectronInterface, ElectronType[ElectronInterface]>;
  var packageJson: PackageJson;
}

export const browser: WebdriverIO.Browser = wdioBrowser;
