import log from '@wdio/electron-utils/log';
import type {
  AbstractFn,
  BrowserExtension,
  ElectronInterface,
  ElectronServiceGlobalOptions,
  ElectronType,
  ExecuteOpts,
} from '@wdio/electron-types';
import type { Capabilities, Services } from '@wdio/types';
import type { Browser as PuppeteerBrowser } from 'puppeteer-core';

import mockStore from './mockStore.js';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import { ensureActiveWindowFocus, getActiveWindowHandle } from './window.js';
import { execute } from './commands/execute.js';
import { mock } from './commands/mock.js';
import { clearAllMocks } from './commands/clearAllMocks.js';
import { isMockFunction } from './commands/isMockFunction.js';
import { resetAllMocks } from './commands/resetAllMocks.js';
import { restoreAllMocks } from './commands/restoreAllMocks.js';
import { mockAll } from './commands/mockAll.js';
import { getDebuggerEndpoint, ElectronCdpBridge } from './bridge.js';

const waitUntilWindowAvailable = async (browser: WebdriverIO.Browser) =>
  await browser.waitUntil(async () => {
    const numWindows = (await browser.getWindowHandles()).length;
    return numWindows > 0;
  });

const copyOriginalApi = async (browser: WebdriverIO.Browser) => {
  await browser.electron.execute<void, [ExecuteOpts]>(
    async (electron) => {
      const { default: copy } = await import('fast-copy');
      globalThis.originalApi = {} as unknown as Record<ElectronInterface, ElectronType[ElectronInterface]>;
      for (const api in electron) {
        const apiName = api as keyof ElectronType;
        globalThis.originalApi[apiName] = {} as ElectronType[ElectronInterface];
        for (const apiElement in electron[apiName]) {
          const apiElementName = apiElement as keyof ElectronType[ElectronInterface];
          globalThis.originalApi[apiName][apiElementName] = copy(electron[apiName][apiElementName]);
        }
      }
    },
    { internal: true },
  );
};

const isInternalCommand = (args: unknown[]) => Boolean((args.at(-1) as ExecuteOpts)?.internal);

export default class ElectronWorkerService implements Services.ServiceInstance {
  #browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;
  #puppeteerBrowser?: PuppeteerBrowser;
  #cdpBridge?: ElectronCdpBridge;
  #globalOptions: ElectronServiceGlobalOptions;
  #clearMocks = false;
  #resetMocks = false;
  #restoreMocks = false;

  constructor(globalOptions: ElectronServiceGlobalOptions = {}) {
    this.#globalOptions = globalOptions;
  }

  get browser() {
    return this.#browser;
  }

  set browser(browser) {
    this.#browser = browser;
  }

  #getElectronAPI(browserInstance?: WebdriverIO.Browser, cdpBridgeInstance?: ElectronCdpBridge) {
    const browser = (browserInstance || this.browser) as WebdriverIO.Browser;
    const cdpBridge = cdpBridgeInstance || this.#cdpBridge;
    const api = {
      clearAllMocks: clearAllMocks.bind(this),
      execute: (script: string | AbstractFn, ...args: unknown[]) =>
        execute.apply(this, [browser, cdpBridge, script, ...args]),
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
    const { clearMocks, resetMocks, restoreMocks } = Object.assign(
      {},
      this.#globalOptions,
      capabilities[CUSTOM_CAPABILITY_NAME],
    );

    this.#clearMocks = clearMocks ?? false;
    this.#resetMocks = resetMocks ?? false;
    this.#restoreMocks = restoreMocks ?? false;
    this.#browser = browser;
    if (!this.#browser.isMultiremote) {
      this.#cdpBridge = new ElectronCdpBridge(getDebuggerEndpoint(capabilities));
      await this.#cdpBridge.connect();
    }
    /**
     * Add electron API to browser object
     */
    this.#browser.electron = this.#getElectronAPI();

    if (this.#browser.isMultiremote) {
      const mrBrowser = instance as WebdriverIO.MultiRemoteBrowser;
      for (const instance of mrBrowser.instances) {
        const mrInstance = mrBrowser.getInstance(instance);
        const caps =
          (mrInstance.requestedCapabilities as Capabilities.W3CCapabilities).alwaysMatch ||
          (mrInstance.requestedCapabilities as WebdriverIO.Capabilities);

        if (!caps[CUSTOM_CAPABILITY_NAME]) {
          continue;
        }

        log.debug('Adding Electron API to browser object instance named: ', instance);
        const mrCdpBridge = new ElectronCdpBridge(getDebuggerEndpoint(caps));
        mrInstance.electron = this.#getElectronAPI(mrInstance, mrCdpBridge);

        const mrPuppeteer = await mrInstance.getPuppeteer();
        mrInstance.electron.windowHandle = await getActiveWindowHandle(mrPuppeteer);

        // wait until an Electron BrowserWindow is available
        await waitUntilWindowAvailable(mrInstance);
        await mrCdpBridge.connect();
        await copyOriginalApi(mrInstance);
      }
    } else {
      const puppeteer = await browser.getPuppeteer();
      this.#puppeteerBrowser = puppeteer;
      this.#browser.electron.windowHandle = await getActiveWindowHandle(puppeteer);
      // wait until an Electron BrowserWindow is available
      await waitUntilWindowAvailable(browser);
      await copyOriginalApi(this.#browser);
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

  async beforeCommand(commandName: string, args: unknown[]) {
    const excludeCommands = ['getWindowHandle', 'getWindowHandles', 'switchToWindow', 'execute'];
    if (!this.#browser || excludeCommands.includes(commandName) || isInternalCommand(args)) {
      return;
    }
    await ensureActiveWindowFocus(this.#browser, commandName, this.#puppeteerBrowser);
  }

  async afterCommand(commandName: string, args: unknown[]) {
    // ensure mocks are updated
    const mocks = mockStore.getMocks();

    // White list of command which will input user actions to electron app.
    const inputCommands = [
      'addValue',
      'clearValue',
      'click',
      'doubleClick',
      'dragAndDrop',
      'execute',
      'executeAsync',
      'moveTo',
      'scrollIntoView',
      'selectByAttribute',
      'selectByIndex',
      'selectByVisibleText',
      'setValue',
      'touchAction',
      'action',
      'actions',
      'emulate',
      'keys',
      'scroll',
      'setWindowSize',
      'uploadFile',
    ];

    if (inputCommands.includes(commandName) && mocks.length > 0 && !isInternalCommand(args)) {
      await Promise.all(mocks.map(async ([_mockId, mock]) => await mock.update()));
    }
  }
}
