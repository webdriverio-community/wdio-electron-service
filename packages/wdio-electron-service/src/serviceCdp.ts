import log from '@wdio/electron-utils/log';

import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import { getActiveWindowHandle } from './window.js';
import * as commands from './commands/index.js';
import { execute } from './commands/executeCdp.js';
import { getDebuggerEndpoint, ElectronCdpBridge } from './bridge.js';
import { ServiceConfig } from './serviceConfig.js';

import type { Capabilities } from '@wdio/types';
import type { AbstractFn, BrowserExtension, ElectronInterface, ElectronType, ExecuteOpts } from '@wdio/electron-types';
import type { CdpBridgeOptions } from '@wdio/cdp-bridge';

export async function before(
  this: ServiceConfig,
  capabilities: WebdriverIO.Capabilities,
  instance: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
): Promise<void> {
  this.browser = instance as WebdriverIO.Browser;
  const cdpBridge = this.browser.isMultiremote ? undefined : await initCdpBridge(this.cdpOptions, capabilities);

  /**
   * Add electron API to browser object
   */
  this.browser.electron = getElectronAPI.call(this, this.browser, cdpBridge);

  if (isMultiremote(instance)) {
    const mrBrowser = instance;
    for (const instance of mrBrowser.instances) {
      const mrInstance = mrBrowser.getInstance(instance);
      const caps =
        (mrInstance.requestedCapabilities as Capabilities.W3CCapabilities).alwaysMatch ||
        (mrInstance.requestedCapabilities as WebdriverIO.Capabilities);

      if (!caps[CUSTOM_CAPABILITY_NAME]) {
        continue;
      }

      log.debug('Adding Electron API to browser object instance named: ', instance);
      const mrCdpBridge = await initCdpBridge(this.cdpOptions, caps);
      mrInstance.electron = getElectronAPI.call(this, mrInstance, mrCdpBridge);

      const mrPuppeteer = await mrInstance.getPuppeteer();
      mrInstance.electron.windowHandle = await getActiveWindowHandle(mrPuppeteer);

      // wait until an Electron BrowserWindow is available
      await waitUntilWindowAvailable(mrInstance);
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

function isMultiremote(
  browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
): browser is WebdriverIO.MultiRemoteBrowser {
  return browser.isMultiremote;
}

async function initCdpBridge(cdpOptions: CdpBridgeOptions, capabilities: WebdriverIO.Capabilities) {
  const options = Object.assign({}, cdpOptions, getDebuggerEndpoint(capabilities));

  const cdpBridge = new ElectronCdpBridge(options);
  await cdpBridge.connect();
  return cdpBridge;
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
    clearAllMocks: commands.clearAllMocks.bind(this),
    execute: (script: string | AbstractFn, ...args: unknown[]) =>
      execute.apply(this, [browser, cdpBridge, script, ...args]),
    isMockFunction: commands.isMockFunction.bind(this),
    mock: commands.mock.bind(this),
    mockAll: commands.mockAll.bind(this),
    resetAllMocks: commands.resetAllMocks.bind(this),
    restoreAllMocks: commands.restoreAllMocks.bind(this),
  };
  return Object.assign({}, api) as unknown as BrowserExtension['electron'];
}
