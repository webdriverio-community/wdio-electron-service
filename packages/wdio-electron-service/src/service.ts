import type { Capabilities, Services } from '@wdio/types';
import type { CDPSession, Protocol, Browser as PuppeteerBrowser } from 'puppeteer-core';

import log from '@wdio/electron-utils/log';
import mockStore from './mockStore.js';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import { execute } from './commands/execute.js';
import { mock } from './commands/mock.js';
import { clearAllMocks } from './commands/clearAllMocks.js';
import { isMockFunction } from './commands/isMockFunction.js';
import { resetAllMocks } from './commands/resetAllMocks.js';
import { restoreAllMocks } from './commands/restoreAllMocks.js';
import { mockAll } from './commands/mockAll.js';
import type { AbstractFn, BrowserExtension, ElectronServiceOptions, ExecuteOpts } from './index.js';
import { SevereServiceError } from 'webdriverio';

const waitUntilWindowAvailable = async (browser: WebdriverIO.Browser) =>
  await browser.waitUntil(async () => {
    const numWindows = (await browser.getWindowHandles()).length;
    return numWindows > 0;
  });

export default class ElectronWorkerService implements Services.ServiceInstance {
  #browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;
  #cdpSession?: CDPSession;
  #puppeteerBrowser?: PuppeteerBrowser;
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

  #getElectronAPI(executionContextId: number, browserInstance?: WebdriverIO.Browser) {
    const browser = (browserInstance || this.browser) as WebdriverIO.Browser;
    const api = {
      clearAllMocks: clearAllMocks.bind(this),
      execute: (script: string | AbstractFn, ...args: unknown[]) =>
        execute.apply(this, [browser, this.#cdpSession as CDPSession, executionContextId, script, ...args]),
      isMockFunction: isMockFunction.bind(this),
      mock: mock.bind(this),
      mockAll: mockAll.bind(this),
      resetAllMocks: resetAllMocks.bind(this),
      restoreAllMocks: restoreAllMocks.bind(this),
    };
    return Object.assign({}, api) as unknown as BrowserExtension['electron'];
  }

  #getExecutionContext() {
    return new Promise<Protocol.Runtime.ExecutionContextDescription>(async (resolve) => {
      this.#cdpSession?.on(
        'Runtime.executionContextCreated',
        (event: Protocol.Runtime.ExecutionContextCreatedEvent) => {
          log.debug('Execution context created:', event, event.context.id);
          resolve(event.context);
        },
      );

      log.debug('Getting Execution Context');

      await this.#cdpSession?.send('Runtime.disable');
      await this.#cdpSession?.send('Runtime.enable');
    });
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
    this.#puppeteerBrowser = await browser.getPuppeteer();

    const targets = this.#puppeteerBrowser.targets();
    log.debug('Targets:', targets);
    // const target = this.#puppeteerBrowser.target();

    const backgroundPage = targets.find((target) => {
      log.debug('Checking target type:', target.type());
      return target.type() === 'background_page';
    });

    if (!backgroundPage) {
      throw new SevereServiceError('Target could not be found');
    }

    this.#cdpSession = await backgroundPage.createCDPSession();
    // this.#cdpSession = await target?.createCDPSession();

    if (!this.#cdpSession) {
      throw new SevereServiceError('CDP session could not be established');
    }

    const executionContextId = (await this.#getExecutionContext()).id;

    /**
     * add electron API to browser object
     */
    browser.electron = this.#getElectronAPI(executionContextId);
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
        mrInstance.electron = this.#getElectronAPI(executionContextId, mrInstance);

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
