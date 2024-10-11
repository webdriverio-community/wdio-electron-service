import log from '@wdio/electron-utils/log';
import type { AbstractFn, BrowserExtension, ElectronServiceOptions, ExecuteOpts } from '@wdio/electron-types';
import type { Capabilities, Services } from '@wdio/types';

import mockStore from './mockStore.js';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import { execute } from './commands/execute.js';
import { mock } from './commands/mock.js';
import { clearAllMocks } from './commands/clearAllMocks.js';
import { isMockFunction } from './commands/isMockFunction.js';
import { resetAllMocks } from './commands/resetAllMocks.js';
import { restoreAllMocks } from './commands/restoreAllMocks.js';
import { mockAll } from './commands/mockAll.js';

const waitUntilWindowAvailable = async (browser: WebdriverIO.Browser) =>
  await browser.waitUntil(async () => {
    const numWindows = (await browser.getWindowHandles()).length;
    return numWindows > 0;
  });

export default class ElectronWorkerService implements Services.ServiceInstance {
  #browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;
  #globalOptions: ElectronServiceOptions;
  #clearMocks = false;
  #resetMocks = false;
  #restoreMocks = false;

  constructor(globalOptions: ElectronServiceOptions = {}) {
    this.#globalOptions = globalOptions;
  }

  get browser() {
    return this.#browser;
  }

  set browser(browser) {
    this.#browser = browser;
  }

  #getElectronAPI(browserInstance?: WebdriverIO.Browser) {
    const browser = (browserInstance || this.browser) as WebdriverIO.Browser;
    const api = {
      clearAllMocks: clearAllMocks.bind(this),
      execute: (script: string | AbstractFn, ...args: unknown[]) => execute.apply(this, [browser, script, ...args]),
      isMockFunction: isMockFunction.bind(this),
      mock: mock.bind(this),
      mockAll: mockAll.bind(this),
      resetAllMocks: resetAllMocks.bind(this),
      restoreAllMocks: restoreAllMocks.bind(this),
    };
    return Object.assign({}, api) as unknown as BrowserExtension['electron'];
  }

  async before(
    capabilities: WebdriverIO.Capabilities,
    _specs: string[],
    instance: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): Promise<void> {
    const browser = instance as WebdriverIO.Browser;
    const mrBrowser = instance as WebdriverIO.MultiRemoteBrowser;
    const { clearMocks, resetMocks, restoreMocks } = Object.assign(
      {},
      this.#globalOptions,
      capabilities[CUSTOM_CAPABILITY_NAME],
    );

    this.#clearMocks = clearMocks ?? false;
    this.#resetMocks = resetMocks ?? false;
    this.#restoreMocks = restoreMocks ?? false;
    this.#browser = browser;

    /**
     * Add electron API to browser object
     */
    browser.electron = this.#getElectronAPI();

    // Add __name to the global object to work around issue with function serialization
    // This enables browser.execute to work with scripts which declare functions (affects TS specs only)
    // https://github.com/webdriverio-community/wdio-electron-service/issues/756
    // https://github.com/privatenumber/tsx/issues/113
    try {
      await browser.execute(() => {
        globalThis.__name = globalThis.__name ?? ((func: (...args: unknown[]) => unknown) => func);
      });
      await browser.electron.execute(() => {
        globalThis.__name = globalThis.__name ?? ((func: (...args: unknown[]) => unknown) => func);
      });
    } catch (error) {
      log.debug('Failed to add __name to global object:', error);
    }

    if (this.#browser.isMultiremote) {
      for (const instance of mrBrowser.instances) {
        const mrInstance = mrBrowser.getInstance(instance);
        const caps =
          (mrInstance.requestedCapabilities as Capabilities.W3CCapabilities).alwaysMatch ||
          (mrInstance.requestedCapabilities as WebdriverIO.Capabilities);

        if (!caps[CUSTOM_CAPABILITY_NAME]) {
          continue;
        }

        log.debug('Adding Electron API to browser object instance named: ', instance);
        mrInstance.electron = this.#getElectronAPI(mrInstance);

        // wait until an Electron BrowserWindow is available
        await waitUntilWindowAvailable(mrInstance);
      }
    } else {
      // wait until an Electron BrowserWindow is available
      await waitUntilWindowAvailable(browser);
    }
  }

  async beforeTest() {
    if (this.#clearMocks) {
      await clearAllMocks();
    }
    if (this.#resetMocks) {
      await resetAllMocks();
    }
    if (this.#restoreMocks) {
      await restoreAllMocks();
    }
  }

  async afterCommand(commandName: string, args: unknown[]) {
    // ensure mocks are updated
    const mocks = mockStore.getMocks();
    const isInternalCommand = () => Boolean((args.at(-1) as ExecuteOpts)?.internal);

    if (commandName === 'execute' && mocks.length > 0 && !isInternalCommand()) {
      await Promise.all(mocks.map(async ([_mockId, mock]) => await mock.update()));
    }
  }
}
