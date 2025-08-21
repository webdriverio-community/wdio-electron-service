import log from '@wdio/electron-utils/log';
import type { AbstractFn, BrowserExtension, ElectronServiceGlobalOptions, ExecuteOpts } from '@wdio/electron-types';
import type { Capabilities, Services } from '@wdio/types';

import mockStore from './mockStore.js';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import { clearPuppeteerSessions, ensureActiveWindowFocus, getActiveWindowHandle, getPuppeteer } from './window.js';
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

        const mrPuppeteer = await getPuppeteer(mrInstance);
        mrInstance.electron.windowHandle = await getActiveWindowHandle(mrPuppeteer);
        mrInstance.electron.bridgeActive = await isBridgeActive(mrInstance);

        if (mrInstance.electron.bridgeActive) {
          await initSerializationWorkaround(mrInstance);
        }

        // wait until an Electron BrowserWindow is available
        await waitUntilWindowAvailable(mrInstance);
      }
    } else {
      const puppeteer = await getPuppeteer(this.browser);
      this.browser.electron.windowHandle = await getActiveWindowHandle(puppeteer);
      // wait until an Electron BrowserWindow is available
      await waitUntilWindowAvailable(this.browser);
    }

    // Install command overrides after all browser setup is complete
    // This must happen after the Electron API is added to the browser object
    log.debug('Installing command overrides after full browser setup is complete');
    this.installCommandOverrides();
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
    await ensureActiveWindowFocus(this.browser, commandName);
  }

  /**
   * Install command overrides to trigger mock updates after DOM interactions
   */
  private installCommandOverrides() {
    if (!this.browser) {
      log.debug('installCommandOverrides: No browser instance, skipping');
      return;
    }

    log.debug('Installing command overrides for mock auto-update');

    // Commands that trigger DOM interactions and need mock updates
    const commandsToOverride = ['click', 'doubleClick', 'setValue', 'clearValue'];

    commandsToOverride.forEach((commandName) => {
      // Override element-level commands
      log.debug(`Installing command override for: ${commandName}`);
      this.overrideElementCommand(commandName);
    });

    log.debug('Command overrides installation completed');
  }

  /**
   * Override an element-level command to add mock update after execution
   */
  private overrideElementCommand(commandName: string) {
    if (!this.browser) {
      log.debug(`overrideElementCommand: No browser for command ${commandName}`);
      return;
    }

    log.debug(`Overriding element command: ${commandName}`);

    try {
      // Override element commands by attaching to element prototype
      this.browser.overwriteCommand(commandName as any, async function (
        this: WebdriverIO.Element,
        originalCommand: (...args: unknown[]) => Promise<unknown>,
        ...args: unknown[]
      ) {
        log.debug(`Command override triggered for ${commandName}`);

        // Execute the original command
        const result = await originalCommand.apply(this, args);
        log.debug(`Original command ${commandName} completed`);

        // Update all mocks after the command completes
        log.debug(`Calling updateAllMocks after ${commandName}...`);
        await updateAllMocks();
        log.debug(`updateAllMocks completed after ${commandName}`);

        return result;
      }, true); // true = element level

      log.debug(`Successfully overrode element command: ${commandName}`);

      // Also try browser-level override as backup
      this.browser.overwriteCommand(commandName as any, async function (
        this: WebdriverIO.Browser,
        originalCommand: (...args: unknown[]) => Promise<unknown>,
        ...args: unknown[]
      ) {
        log.debug(`Browser-level command override triggered for ${commandName}`);

        const result = await originalCommand.apply(this, args);
        log.debug(`Browser-level ${commandName} completed`);

        log.debug(`Browser-level calling updateAllMocks after ${commandName}...`);
        await updateAllMocks();
        log.debug(`Browser-level updateAllMocks completed after ${commandName}`);

        return result;
      }, false); // false = browser level

      log.debug(`Successfully overrode browser command: ${commandName}`);
    } catch (error) {
      log.debug(`Error overriding command ${commandName}:`, error);
    }
  }

  after() {
    clearPuppeteerSessions();
  }
}

/**
 * Update all existing mocks
 */
async function updateAllMocks() {
  log.debug('updateAllMocks called');
  const mocks = mockStore.getMocks();
  log.debug(`Found ${mocks.length} mocks to update`);

  if (mocks.length === 0) {
    log.debug('No mocks to update, returning');
    return;
  }

  try {
    log.debug('Starting mock update batch');
    await Promise.all(
      mocks.map(async ([mockId, mock]) => {
        log.debug(`Updating mock: ${mockId}`);
        await mock.update();
        log.debug(`Mock update completed: ${mockId}`);
      }),
    );
    log.debug('All mock updates completed successfully');
  } catch (error) {
    log.debug('Mock update batch failed:', error);
  }
}
