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
import { checkInspectFuse } from './fuses.js';
import mockStore from './mockStore.js';
import { ServiceConfig } from './serviceConfig.js';
import { clearPuppeteerSessions, ensureActiveWindowFocus, getActiveWindowHandle, getPuppeteer } from './window.js';

const log = createLogger('service');

const isInternalCommand = (args: unknown[]) => Boolean((args.at(-1) as ExecuteOpts)?.internal);

type ElementCommands = 'click' | 'doubleClick' | 'setValue' | 'clearValue';

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
    log.debug('Initialising CDP bridge...');

    this.browser = instance as WebdriverIO.Browser;
    const cdpBridge = this.browser.isMultiremote ? undefined : await initCdpBridge(this.cdpOptions, capabilities);

    /**
     * Add electron API to browser object
     */
    this.browser.electron = getElectronAPI.call(this, this.browser, cdpBridge);

    // Install element command overrides after Electron API is added to the browser object
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
      return;
    }
    const commandsToOverride = ['click', 'doubleClick', 'setValue', 'clearValue'];
    commandsToOverride.forEach((commandName) => {
      this.overrideElementCommand(commandName as ElementCommands);
    });
  }

  /**
   * Override an element-level command to add mock update after execution
   */
  private overrideElementCommand(commandName: ElementCommands) {
    if (!this.browser) {
      return;
    }
    try {
      const testOverride = async function (
        this: WebdriverIO.Element,
        originalCommand: (...args: readonly unknown[]) => Promise<unknown>,
        ...args: readonly unknown[]
      ): Promise<unknown> {
        // Use Reflect.apply to safely call the original command with the correct 'this' context
        // This avoids TypeScript's strict function signature checking while maintaining runtime safety
        const result = await Reflect.apply(originalCommand, this, args as unknown[]);
        await updateAllMocks();
        return result;
      } as Parameters<typeof this.browser.overwriteCommand>[1];

      this.browser.overwriteCommand(commandName, testOverride, true);
    } catch {
      // ignore
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

async function initCdpBridge(
  cdpOptions: CdpBridgeOptions,
  capabilities: WebdriverIO.Capabilities,
): Promise<ElectronCdpBridge | undefined> {
  // Check if the Electron binary has the necessary fuse enabled
  const binaryPath = capabilities['goog:chromeOptions']?.binary;
  if (binaryPath && typeof binaryPath === 'string') {
    const fuseCheck = await checkInspectFuse(binaryPath);

    // Fuse is disabled - cannot use CDP bridge
    if (!fuseCheck.canUseCdpBridge) {
      log.warn('CDP bridge cannot be initialized: EnableNodeCliInspectArguments fuse is disabled.');
      log.warn('The browser.electron API for main process access will not be available.');
      log.warn('To enable the CDP bridge, ensure this fuse is enabled in your test builds.');
      log.warn('See: https://www.electronjs.org/docs/latest/tutorial/fuses#nodecliinspect');
      return undefined;
    }

    // Fuse check encountered an error but we're proceeding anyway
    if (fuseCheck.error) {
      log.warn(fuseCheck.error);
    }
  }

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
