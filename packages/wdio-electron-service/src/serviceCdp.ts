import log from '@wdio/electron-utils/log';

import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import { ensureActiveWindowFocus, getActiveWindowHandle } from './window.js';
import { execute } from './commands/executeCdp.js';
import { mock } from './commands/mock.js';
import { clearAllMocks } from './commands/clearAllMocks.js';
import { isMockFunction } from './commands/isMockFunction.js';
import { resetAllMocks } from './commands/resetAllMocks.js';
import { restoreAllMocks } from './commands/restoreAllMocks.js';
import { mockAll } from './commands/mockAll.js';
import { getDebuggerEndpoint, ElectronCdpBridge } from './bridge.js';
import { ServiceConfig } from './serviceConfig.js';
import mockStore from './mockStore.js';

import type {
  AbstractFn,
  BrowserExtension,
  ElectronInterface,
  ElectronServiceGlobalOptions,
  ElectronType,
  ExecuteOpts,
} from '@wdio/electron-types';
import type { Capabilities, Services } from '@wdio/types';

export async function before(
  this: ServiceConfig,
  capabilities: WebdriverIO.Capabilities,
  instance: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
): Promise<void> {
  const browser = instance as WebdriverIO.Browser;
  this.browser = browser;
  const cdpBridge = this.browser.isMultiremote ? undefined : await initCdpBridge(capabilities);

  /**
   * Add electron API to browser object
   */
  this.browser.electron = getElectronAPI.call(this, this.browser, cdpBridge);

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
      const mrCdpBridge = new ElectronCdpBridge(getDebuggerEndpoint(caps));
      mrInstance.electron = getElectronAPI.call(this, mrInstance, mrCdpBridge);

      const mrPuppeteer = await mrInstance.getPuppeteer();
      mrInstance.electron.windowHandle = await getActiveWindowHandle(mrPuppeteer);

      // wait until an Electron BrowserWindow is available
      await waitUntilWindowAvailable(mrInstance);
      await mrCdpBridge.connect();
      await copyOriginalApi(mrInstance);
    }
  } else {
    const puppeteer = await browser.getPuppeteer();
    this.puppeteerBrowser = puppeteer;
    this.browser.electron.windowHandle = await getActiveWindowHandle(puppeteer);
    // wait until an Electron BrowserWindow is available
    await waitUntilWindowAvailable(browser);
    await copyOriginalApi(this.browser);
  }
}

async function initCdpBridge(capabilities: WebdriverIO.Capabilities) {
  const cdpBridge = new ElectronCdpBridge(getDebuggerEndpoint(capabilities));
  await cdpBridge.connect();
  return cdpBridge;
}

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

function getElectronAPI(
  this: ServiceConfig,
  browserInstance?: WebdriverIO.Browser,
  cdpBridgeInstance?: ElectronCdpBridge,
) {
  const browser = (browserInstance || this.browser) as WebdriverIO.Browser;
  const cdpBridge = cdpBridgeInstance || this.cdpBridge;
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

export default class ElectronWorkerService extends ServiceConfig implements Services.ServiceInstance {
  constructor(globalOptions: ElectronServiceGlobalOptions = {}) {
    super(globalOptions);
  }

  async before(
    capabilities: WebdriverIO.Capabilities,
    _specs: string[],
    instance: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): Promise<void> {
    this.init(capabilities);
    const browser = instance as WebdriverIO.Browser;
    this.browser = browser;
    if (!this.browser.isMultiremote) {
      this.cdpBridge = new ElectronCdpBridge(getDebuggerEndpoint(capabilities));
      await this.cdpBridge.connect();
    }
    /**
     * Add electron API to browser object
     */
    this.browser.electron = getElectronAPI.call(this);

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
        const mrCdpBridge = new ElectronCdpBridge(getDebuggerEndpoint(caps));
        mrInstance.electron = getElectronAPI.call(this, mrInstance, mrCdpBridge);

        const mrPuppeteer = await mrInstance.getPuppeteer();
        mrInstance.electron.windowHandle = await getActiveWindowHandle(mrPuppeteer);

        // wait until an Electron BrowserWindow is available
        await waitUntilWindowAvailable(mrInstance);
        await mrCdpBridge.connect();
        await copyOriginalApi(mrInstance);
      }
    } else {
      const puppeteer = await browser.getPuppeteer();
      this.puppeteerBrowser = puppeteer;
      this.browser.electron.windowHandle = await getActiveWindowHandle(puppeteer);
      // wait until an Electron BrowserWindow is available
      await waitUntilWindowAvailable(browser);
      await copyOriginalApi(this.browser);
    }
  }

  async beforeTest() {
    if (this.clearMocks) {
      await clearAllMocks();
    }
    if (this.resetMocks) {
      await resetAllMocks();
    }
    if (this.restoreMocks) {
      await restoreAllMocks();
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

const isInternalCommand = (args: unknown[]) => Boolean((args.at(-1) as ExecuteOpts)?.internal);
