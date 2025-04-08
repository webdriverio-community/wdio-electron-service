import log from '@wdio/electron-utils/log';
import type { AbstractFn, BrowserExtension, ElectronServiceGlobalOptions, ExecuteOpts } from '@wdio/electron-types';
import type { Capabilities, Services } from '@wdio/types';

import mockStore from './mockStore.js';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import { ensureActiveWindowFocus, getActiveWindowHandle } from './window.js';
import * as commands from './commands/index.js';
import { execute } from './commands/execute.js';
import { ServiceConfig } from './serviceConfig.js';
import { before, waitUntilWindowAvailable } from './serviceCdp.js';
import { ipcBridgeCheck } from './ipc.js';

const isBridgeActive = async (browser: WebdriverIO.Browser) =>
  await browser.execute(function executeWithinElectron() {
    return window.wdioElectron !== undefined;
  });

const initSerializationWorkaround = async (browser: WebdriverIO.Browser) => {
  // Add __name to the global object to work around issue with function serialization
  // This enables browser.execute to work with scripts which declare functions (affects TS specs only)
  // https://github.com/webdriverio-community/wdio-electron-service/issues/756
  // https://github.com/privatenumber/tsx/issues/113
  await browser.execute(() => {
    globalThis.__name = globalThis.__name ?? ((func: (...args: unknown[]) => unknown) => func);
  });
  await browser.electron.execute(() => {
    globalThis.__name = globalThis.__name ?? ((func: (...args: unknown[]) => unknown) => func);
  });
};

const isInternalCommand = (args: unknown[]) => Boolean((args.at(-1) as ExecuteOpts)?.internal);

export default class ElectronWorkerService extends ServiceConfig implements Services.ServiceInstance {
  constructor(
    globalOptions: ElectronServiceGlobalOptions = {},
    capabilities: WebdriverIO.Capabilities,
    _config?: unknown,
  ) {
    super(globalOptions, capabilities);
  }

  #getElectronAPI(browserInstance?: WebdriverIO.Browser) {
    const browser = (browserInstance || this.browser) as WebdriverIO.Browser;
    const api = {
      clearAllMocks: commands.clearAllMocks.bind(this),
      execute: (script: string | AbstractFn, ...args: unknown[]) => execute.apply(this, [browser, script, ...args]),
      isMockFunction: commands.isMockFunction.bind(this),
      mock: commands.mock.bind(this),
      mockAll: commands.mockAll.bind(this),
      resetAllMocks: commands.resetAllMocks.bind(this),
      restoreAllMocks: commands.restoreAllMocks.bind(this),
    };
    return Object.assign({}, api) as unknown as BrowserExtension['electron'];
  }

  async before(
    capabilities: WebdriverIO.Capabilities,
    _specs: string[],
    instance: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): Promise<void> {
    if (this.useCdpBridge) {
      log.debug('Using CDP bridge');
      await ipcBridgeCheck(instance);
      await before.call(this, capabilities, instance);
      return;
    }
    log.debug('Using IPC bridge');
    this.browser = instance as WebdriverIO.Browser;

    /**
     * Add electron API to browser object
     */
    this.browser.electron = this.#getElectronAPI();

    this.browser.electron.bridgeActive = await isBridgeActive(this.browser);

    if (this.browser.electron.bridgeActive) {
      await initSerializationWorkaround(this.browser);
    }

    if (this.browser.isMultiremote) {
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
        mrInstance.electron = this.#getElectronAPI(mrInstance);

        const mrPuppeteer = await mrInstance.getPuppeteer();
        mrInstance.electron.windowHandle = await getActiveWindowHandle(mrPuppeteer);
        mrInstance.electron.bridgeActive = await isBridgeActive(mrInstance);

        if (mrInstance.electron.bridgeActive) {
          await initSerializationWorkaround(mrInstance);
        }

        // wait until an Electron BrowserWindow is available
        await waitUntilWindowAvailable(mrInstance);
      }
    } else {
      const puppeteer = await this.browser.getPuppeteer();
      this.puppeteerBrowser = puppeteer;
      this.browser.electron.windowHandle = await getActiveWindowHandle(puppeteer);
      // wait until an Electron BrowserWindow is available
      await waitUntilWindowAvailable(this.browser);
    }
  }

  async beforeTest() {
    if (this.clearMocks) {
      await commands.clearAllMocks();
    }
    if (this.resetMocks) {
      await commands.resetAllMocks();
    }
    if (this.restoreMocks) {
      await commands.restoreAllMocks();
    }
  }

  async beforeCommand(commandName: string, args: unknown[]) {
    const excludeCommands = ['getWindowHandle', 'getWindowHandles', 'switchToWindow', 'execute'];
    if (!this.browser || excludeCommands.includes(commandName) || isInternalCommand(args)) {
      return;
    }
    await ensureActiveWindowFocus(this.browser, commandName, this.puppeteerBrowser);
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
