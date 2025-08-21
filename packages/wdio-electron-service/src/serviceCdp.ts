import log from '@wdio/electron-utils/log';

import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import { getActiveWindowHandle, getPuppeteer } from './window.js';
import * as commands from './commands/index.js';
import { execute } from './commands/executeCdp.js';
import { getDebuggerEndpoint, ElectronCdpBridge } from './bridge.js';
import { ServiceConfig } from './serviceConfig.js';
import mockStore from './mockStore.js';

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

      const mrPuppeteer = await getPuppeteer(mrInstance);
      mrInstance.electron.windowHandle = await getActiveWindowHandle(mrPuppeteer);

      // wait until an Electron BrowserWindow is available
      await waitUntilWindowAvailable(mrInstance);
      await copyOriginalApi(mrInstance);
    }
  } else {
    const puppeteer = await getPuppeteer(this.browser);
    this.browser.electron.windowHandle = await getActiveWindowHandle(puppeteer);
    // wait until an Electron BrowserWindow is available
    await waitUntilWindowAvailable(this.browser);
    await copyOriginalApi(this.browser);
  }

  // Install command overrides after all browser setup is complete
  // This must happen after the Electron API is added to the browser object
  log.debug('CDP: Installing command overrides after full browser setup is complete');
  log.debug(`CDP: Service browser instance exists: ${!!this.browser}`);
  log.debug(`CDP: Browser overwriteCommand available: ${!!this.browser?.overwriteCommand}`);
  installCommandOverrides.call(this);
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

/**
 * Install command overrides to trigger mock updates after DOM interactions
 */
function installCommandOverrides(this: ServiceConfig) {
  if (!this.browser) {
    log.debug('CDP: installCommandOverrides: No browser instance, skipping');
    return;
  }

  log.debug('CDP: Installing command overrides for mock auto-update');
  log.debug(`CDP: Browser instance type: ${typeof this.browser}`);
  log.debug(`CDP: Browser has overwriteCommand: ${typeof this.browser.overwriteCommand}`);

  // Commands that trigger DOM interactions and need mock updates
  const commandsToOverride = ['click', 'doubleClick', 'setValue', 'clearValue'];

  commandsToOverride.forEach((commandName) => {
    // Override both browser-level and element-level commands
    log.debug(`CDP: Installing command override for: ${commandName}`);
    overrideElementCommand.call(this, commandName);
  });

  log.debug('CDP: Command overrides installation completed');
}

/**
 * Override an element-level command to add mock update after execution
 */
function overrideElementCommand(this: ServiceConfig, commandName: string) {
  if (!this.browser) {
    log.debug(`CDP: overrideElementCommand: No browser for command ${commandName}`);
    return;
  }

  log.debug(`CDP: Overriding element command: ${commandName}`);
  log.debug(`CDP: Browser overwriteCommand type: ${typeof this.browser.overwriteCommand}`);

  try {
    // Test with a simple function first to make sure overriding works
    const testOverride = async function (
      this: WebdriverIO.Element,
      originalCommand: (...args: unknown[]) => Promise<unknown>,
      ...args: unknown[]
    ) {
      // Use console.log to ensure these messages appear regardless of debug settings
      console.log(`🚨 CDP COMMAND OVERRIDE TRIGGERED FOR ${commandName.toUpperCase()} 🚨`);
      log.debug(`🚨 CDP COMMAND OVERRIDE TRIGGERED FOR ${commandName.toUpperCase()} 🚨`);
      log.debug(`CDP Command args:`, args);
      log.debug(`CDP Element context:`, typeof this);

      // Execute the original command
      console.log(`CDP: Executing original ${commandName} command...`);
      log.debug(`CDP: Executing original ${commandName} command...`);
      const result = await originalCommand.apply(this, args);
      console.log(`CDP: Original command ${commandName} completed`);
      log.debug(`CDP: Original command ${commandName} completed with result:`, typeof result);

      // Update all mocks after the command completes
      console.log(`🎯 CDP: Calling updateAllMocks after ${commandName}...`);
      log.debug(`🎯 CDP: Calling updateAllMocks after ${commandName}...`);
      await updateAllMocks();
      console.log(`✅ CDP: updateAllMocks completed after ${commandName}`);
      log.debug(`✅ CDP: updateAllMocks completed after ${commandName}`);

      return result;
    };

    // Override element commands by attaching to element prototype
    this.browser.overwriteCommand(commandName as any, testOverride, true);

    log.debug(`CDP: Successfully overrode element command: ${commandName}`);

    // Also try browser-level override as backup
    log.debug(`CDP: Also installing browser-level override for ${commandName}...`);
    this.browser.overwriteCommand(
      commandName as any,
      async function (
        this: WebdriverIO.Browser,
        originalCommand: (...args: unknown[]) => Promise<unknown>,
        ...args: unknown[]
      ) {
        log.debug(`🚨 CDP: BROWSER-LEVEL COMMAND OVERRIDE TRIGGERED FOR ${commandName.toUpperCase()} 🚨`);

        const result = await originalCommand.apply(this, args);
        log.debug(`CDP: Browser-level ${commandName} completed`);

        log.debug(`🎯 CDP: Browser-level calling updateAllMocks after ${commandName}...`);
        await updateAllMocks();
        log.debug(`✅ CDP: Browser-level updateAllMocks completed after ${commandName}`);

        return result;
      },
      false,
    ); // false = browser level

    log.debug(`CDP: Successfully overrode browser command: ${commandName}`);
  } catch (error) {
    log.debug(`CDP: Error overriding command ${commandName}:`, error);
    log.debug(`CDP: Error details:`, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Update all existing mocks
 */
async function updateAllMocks() {
  log.debug('CDP: updateAllMocks called');
  const mocks = mockStore.getMocks();
  log.debug(`CDP: Found ${mocks.length} mocks to update`);

  if (mocks.length === 0) {
    log.debug('CDP: No mocks to update, returning');
    return;
  }

  try {
    log.debug('CDP: Starting mock update batch');
    await Promise.all(
      mocks.map(async ([mockId, mock]) => {
        log.debug(`CDP: Updating mock: ${mockId}`);
        await mock.update();
        log.debug(`CDP: Mock update completed: ${mockId}`);
      }),
    );
    log.debug('CDP: All mock updates completed successfully');
  } catch (error) {
    log.debug('CDP: Mock update batch failed:', error);
  }
}
