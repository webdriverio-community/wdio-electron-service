import type { Capabilities, Services } from '@wdio/types';

import log from './log.js';
import { execute } from './commands/execute.js';
import { mock } from './commands/mock.js';
import { resetAllMocks } from './commands/resetAllMocks.js';
import { restoreAllMocks } from './commands/restoreAllMocks.js';
import { mockAll } from './commands/mockAll.js';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import mockStore from './mockStore.js';
import type { AbstractFn, BrowserExtension } from './index.js';

export default class ElectronWorkerService implements Services.ServiceInstance {
  #browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;

  constructor() {}

  get browser() {
    return this.#browser;
  }

  set browser(browser) {
    this.#browser = browser;
  }

  #getElectronAPI(browserInstance?: WebdriverIO.Browser) {
    const browser = (browserInstance || this.browser) as WebdriverIO.Browser;
    const api = {
      execute: (script: string | AbstractFn, ...args: unknown[]) => execute.apply(this, [browser, script, ...args]),
      mock: mock.bind(this),
      mockAll: mockAll.bind(this),
      resetAllMocks: resetAllMocks.bind(this),
      restoreAllMocks: restoreAllMocks.bind(this),
    };
    return Object.assign({}, api) as unknown as BrowserExtension['electron'];
  }

  async before(
    _capabilities: Capabilities.RemoteCapability,
    _specs: string[],
    instance: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): Promise<void> {
    const browser = instance as WebdriverIO.Browser;
    const mrBrowser = instance as WebdriverIO.MultiRemoteBrowser;
    this.#browser = browser;

    /**
     * add electron API to browser object
     */
    browser.electron = this.#getElectronAPI();
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
        await mrInstance.waitUntil(async () => {
          const numWindows = await mrInstance.electron.execute(
            (electron) => electron.BrowserWindow.getAllWindows().length,
          );
          return numWindows > 0;
        });
      }
    } else {
      // wait until an Electron BrowserWindow is available
      await browser.waitUntil(async () => {
        const numWindows = await browser.electron.execute((electron) => electron.BrowserWindow.getAllWindows().length);
        return numWindows > 0;
      });
    }
  }

  async afterCommand(commandName: string, _args: unknown[][]) {
    // ensure mocks are updated
    const mocks = mockStore.getMocks();

    if (commandName.includes('execute') && mocks.length > 0) {
      await Promise.all(
        mocks.map(async ([_mockId, mock]) => {
          if (!mock.updating) {
            return await mock.update();
          } else {
            return Promise.resolve();
          }
        }),
      );
    }
  }
}
