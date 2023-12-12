import type { Capabilities, Services } from '@wdio/types';

import log from './log.js';
import { execute } from './commands/execute.js';
import { type ElectronServiceMock, mock } from './commands/mock.js';
import { removeMocks } from './commands/removeMocks.js';
import { mockAll } from './commands/mockAll.js';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import type { BrowserExtension } from './index.js';

export default class ElectronWorkerService implements Services.ServiceInstance {
  #browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;

  constructor() {}

  get browser() {
    return this.#browser;
  }

  set browser(browser) {
    this.#browser = browser;
  }

  #getElectronAPI() {
    const api = {
      _mocks: {} as Record<string, ElectronServiceMock>,
      execute: execute.bind(this),
      mock: mock.bind(this),
      mockAll: mockAll.bind(this),
      removeMocks: removeMocks.bind(this),
    };
    return Object.assign({}, api) as BrowserExtension['electron'];
  }

  before(
    _capabilities: Capabilities.RemoteCapability,
    _specs: string[],
    instance: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): void {
    const browser = instance as WebdriverIO.Browser;
    const mrBrowser = instance as WebdriverIO.MultiRemoteBrowser;
    this.#browser = browser;

    /**
     * add electron API to browser object
     */
    mrBrowser.electron = this.#getElectronAPI();
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
        mrInstance.electron = this.#getElectronAPI();
      }
    }
  }

  async afterCommand(commandName: string) {
    if (commandName === 'execute') {
      // ensure mocks are updated
      const mocks = Object.values<ElectronServiceMock>((this.browser as WebdriverIO.Browser)?.electron._mocks);

      await Promise.all(
        mocks.map(async (mock: ElectronServiceMock) => {
          const mockedFnNames = mock.mockFns.keys();
          await Promise.all(
            Array.from(mockedFnNames).map(async (mockedFnName: string) => {
              await mock.getMock(mockedFnName);
            }),
          );
        }),
      );
    }
  }
}
