import type { CdpBridgeOptions } from '@wdio/cdp-bridge';
import type {
  AbstractFn,
  BrowserExtension,
  ElectronInterface,
  ElectronServiceGlobalOptions,
  ElectronType,
  ExecuteOpts,
} from '@wdio/electron-types';
import { createLogger } from '@wdio/electron-utils';
import type { Capabilities, Services } from '@wdio/types';
import { ElectronCdpBridge, getDebuggerEndpoint } from './bridge.js';
import { execute } from './commands/executeCdp.js';
import * as commands from './commands/index.js';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import mockStore from './mockStore.js';
import { ServiceConfig } from './serviceConfig.js';
import { clearPuppeteerSessions, ensureActiveWindowFocus, getActiveWindowHandle, getPuppeteer } from './window.js';

const log = createLogger('service');

// Log environment variables on module load
log.debug('Service module loaded');
log.debug(`DEBUG environment variable: ${process.env.DEBUG}`);
const isInternalCommand = (args: unknown[]) => Boolean((args.at(-1) as ExecuteOpts)?.internal);

export default class ElectronWorkerService extends ServiceConfig implements Services.ServiceInstance {
  constructor(
    globalOptions: ElectronServiceGlobalOptions = {},
    capabilities: WebdriverIO.Capabilities,
    _config?: unknown,
  ) {
    super(globalOptions, capabilities);
  }

  async before(
    capabilities: WebdriverIO.Capabilities,
    _specs: string[],
    instance: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): Promise<void> {
    log.debug('Using CDP bridge');
    console.log('Using CDP bridge');

    this.browser = instance as WebdriverIO.Browser;
    const cdpBridge = this.browser.isMultiremote ? undefined : await initCdpBridge(this.cdpOptions, capabilities);

    /**
     * Add electron API to browser object
     */
    this.browser.electron = getElectronAPI.call(this, this.browser, cdpBridge);

    // Install command overrides after all browser setup is complete
    // This must happen after the Electron API is added to the browser object
    log.debug('Installing command overrides after full browser setup is complete');
    log.debug(`Service browser instance exists: ${!!this.browser}`);
    log.debug(`Browser overwriteCommand available: ${!!this.browser?.overwriteCommand}`);
    this.installCommandOverrides();

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

  after() {
    clearPuppeteerSessions();
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
    log.debug(`Browser instance type: ${typeof this.browser}`);
    log.debug(`Browser has overwriteCommand: ${typeof this.browser.overwriteCommand}`);

    // Commands that trigger DOM interactions and need mock updates
    const commandsToOverride = ['click', 'doubleClick', 'setValue', 'clearValue'];

    commandsToOverride.forEach((commandName) => {
      // Override both browser-level and element-level commands
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
    log.debug(`Browser overwriteCommand type: ${typeof this.browser.overwriteCommand}`);

    try {
      // Test with a simple function first to make sure overriding works
      const testOverride = async function (
        this: WebdriverIO.Element,
        originalCommand: (...args: unknown[]) => Promise<unknown>,
        ...args: unknown[]
      ) {
        // Use console.log to ensure these messages appear regardless of debug settings
        console.log(`🚨 COMMAND OVERRIDE TRIGGERED FOR ${commandName.toUpperCase()} 🚨`);
        log.debug(`🚨 COMMAND OVERRIDE TRIGGERED FOR ${commandName.toUpperCase()} 🚨`);
        log.debug(`Command args:`, args);
        log.debug(`Element context:`, typeof this);

        // Execute the original command
        console.log(`Executing original ${commandName} command...`);
        log.debug(`Executing original ${commandName} command...`);
        const result = await originalCommand.apply(this, args);
        console.log(`Original command ${commandName} completed`);
        log.debug(`Original command ${commandName} completed with result:`, typeof result);

        // Update all mocks after the command completes
        console.log(`🎯 Calling updateAllMocks after ${commandName}...`);
        log.debug(`🎯 Calling updateAllMocks after ${commandName}...`);
        await updateAllMocks();
        console.log(`✅ updateAllMocks completed after ${commandName}`);
        log.debug(`✅ updateAllMocks completed after ${commandName}`);

        return result;
      };

      // Override element commands by attaching to element prototype
      this.browser.overwriteCommand(commandName as any, testOverride, true);

      log.debug(`Successfully overrode element command: ${commandName}`);

      // Also try browser-level override as backup
      log.debug(`Also installing browser-level override for ${commandName}...`);
      this.browser.overwriteCommand(
        commandName as any,
        async function (
          this: WebdriverIO.Browser,
          originalCommand: (...args: unknown[]) => Promise<unknown>,
          ...args: unknown[]
        ) {
          log.debug(`🚨 BROWSER-LEVEL COMMAND OVERRIDE TRIGGERED FOR ${commandName.toUpperCase()} 🚨`);

          const result = await originalCommand.apply(this, args);
          log.debug(`Browser-level ${commandName} completed`);

          log.debug(`🎯 Browser-level calling updateAllMocks after ${commandName}...`);
          await updateAllMocks();
          log.debug(`✅ Browser-level updateAllMocks completed after ${commandName}`);

          return result;
        },
        false,
      ); // false = browser level

      log.debug(`Successfully overrode browser command: ${commandName}`);
    } catch (error) {
      log.debug(`Error overriding command ${commandName}:`, error);
      log.debug(`Error details:`, error instanceof Error ? error.message : String(error));
    }
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
