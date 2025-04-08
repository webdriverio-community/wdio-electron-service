import log from '@wdio/electron-utils/log';

import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import { getActiveWindowHandle } from './window.js';
import { execute } from './commands/executeCdp.js';
import { mock } from './commands/mock.js';
import { clearAllMocks } from './commands/clearAllMocks.js';
import { isMockFunction } from './commands/isMockFunction.js';
import { resetAllMocks } from './commands/resetAllMocks.js';
import { restoreAllMocks } from './commands/restoreAllMocks.js';
import { mockAll } from './commands/mockAll.js';
import { getDebuggerEndpoint, ElectronCdpBridge } from './bridge.js';
import { ServiceConfig } from './serviceConfig.js';

import type { AbstractFn, BrowserExtension, ElectronInterface, ElectronType, ExecuteOpts } from '@wdio/electron-types';
import type { Capabilities } from '@wdio/types';

export async function before(
  this: ServiceConfig,
  capabilities: WebdriverIO.Capabilities,
  instance: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
): Promise<void> {
  this.init(capabilities);
  this.browser = instance as WebdriverIO.Browser;
  const cdpBridge = this.browser.isMultiremote ? undefined : await initCdpBridge.call(this, capabilities);

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
      const mrCdpBridge = await initCdpBridge.call(this, caps);
      mrInstance.electron = getElectronAPI.call(this, mrInstance, mrCdpBridge);

      const mrPuppeteer = await mrInstance.getPuppeteer();
      mrInstance.electron.windowHandle = await getActiveWindowHandle(mrPuppeteer);

      // wait until an Electron BrowserWindow is available
      await waitUntilWindowAvailable(mrInstance);
      await mrCdpBridge.connect();
      await copyOriginalApi(mrInstance);
    }
  } else {
    const puppeteer = await this.browser.getPuppeteer();
    this.puppeteerBrowser = puppeteer;
    this.browser.electron.windowHandle = await getActiveWindowHandle(puppeteer);
    // wait until an Electron BrowserWindow is available
    await waitUntilWindowAvailable(this.browser);
    await copyOriginalApi(this.browser);
  }
}

async function initCdpBridge(this: ServiceConfig, capabilities: WebdriverIO.Capabilities) {
  const options = getCdpOptions.call(this, capabilities);
  const cdpBridge = new ElectronCdpBridge(options);
  await cdpBridge.connect();
  return cdpBridge;
}

function getCdpOptions(this: ServiceConfig, capabilities: WebdriverIO.Capabilities) {
  const globalOptions = this.globalOptions;
  const options = getDebuggerEndpoint(capabilities);
  return Object.assign({}, options, {
    ...(globalOptions.cdpConnectionTimeout && { timeout: globalOptions.cdpConnectionTimeout }),
    ...(globalOptions.cdpConnectionWaitInterval && { waitInterval: globalOptions.cdpConnectionWaitInterval }),
    ...(globalOptions.cdpConnectionRetryCount && { connectionRetryCount: globalOptions.cdpConnectionRetryCount }),
  });
}

export const waitUntilWindowAvailable = async (browser: WebdriverIO.Browser) => {
  await browser.waitUntil(async () => {
    const numWindows = (await browser.getWindowHandles()).length;
    return numWindows > 0;
  });
};

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

function getElectronAPI(this: ServiceConfig, browser: WebdriverIO.Browser, cdpBridge?: ElectronCdpBridge) {
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
