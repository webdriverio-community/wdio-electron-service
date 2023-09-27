import fs from 'node:fs/promises';
import path from 'node:path';
import { SevereServiceError } from 'webdriverio';
import { setupDriver, setupBrowser } from '@wdio/utils';
import type { Capabilities, Services, Options } from '@wdio/types';

import {
  log,
  getChromeOptions,
  getChromedriverOptions,
  getChromiumVersion,
  attemptAssetsDownload,
  getElectronCapabilities,
  parseVersion,
} from './utils.js';
import type { ElectronServiceOptions, ApiCommand, ElectronServiceApi, WebdriverClientFunc } from './types.js';

export default class ElectronWorkerService implements Services.ServiceInstance {
  #browser?: WebdriverIO.Browser;
  #globalOptions: ElectronServiceOptions;
  #projectRoot: string;
  #apiCommands = [
    { name: '', bridgeProp: 'custom' },
    { name: 'app', bridgeProp: 'app' },
    { name: 'browserWindow', bridgeProp: 'browserWindow' },
    { name: 'dialog', bridgeProp: 'dialog' },
    { name: 'mainProcess', bridgeProp: 'mainProcess' },
    { name: 'mock', bridgeProp: 'mock' },
  ];

  constructor(globalOptions: ElectronServiceOptions, caps: never, config: Options.Testrunner) {
    this.#globalOptions = globalOptions;
    this.#projectRoot = config.rootDir || process.cwd();

    const { customApiBrowserCommand = 'api' } = globalOptions as ElectronServiceOptions;
    const customCommandCollision = this.#apiCommands.find(
      (command) => command.name === customApiBrowserCommand,
    ) as ApiCommand;
    if (customCommandCollision) {
      const customCommandCollisionError = new Error(
        `The command "${customCommandCollision.name}" is reserved, please provide a different value for customApiBrowserCommand`,
      );
      log.error(customCommandCollisionError);
      throw customCommandCollisionError;
    } else {
      this.#apiCommands[0].name = customApiBrowserCommand;
    }
  }

  async beforeSession(_config: Omit<Options.Testrunner, 'capabilities'>, capabilities: Capabilities.RemoteCapability) {
    const caps = getElectronCapabilities(capabilities) as WebDriver.Capabilities[];
    const pkgJSON = JSON.parse((await fs.readFile(path.join(this.#projectRoot, 'package.json'), 'utf-8')).toString());
    const { dependencies, devDependencies } = pkgJSON;
    const localElectronVersion = parseVersion(dependencies?.electron || devDependencies?.electron);

    await Promise.all(
      caps.map(async (cap) => {
        const electronVersion = cap.browserVersion || localElectronVersion;
        const chromiumVersion = await getChromiumVersion(electronVersion);
        const shouldDownloadChromedriver = Boolean(
          electronVersion && !chromiumVersion && !cap['wdio:chromedriverOptions']?.binary,
        );

        log.debug('cap mapping');
        log.debug(`found Electron v${electronVersion} with Chromedriver v${chromiumVersion}`);
        log.debug(`CD binary: ${cap['wdio:chromedriverOptions']?.binary}`);

        const { binaryPath, appPath, appName, appArgs } = Object.assign(
          {},
          this.#globalOptions,
          cap['wdio:electronServiceOptions'],
        );
        const validPathOpts = binaryPath !== undefined || (appPath !== undefined && appName !== undefined);
        if (!validPathOpts) {
          const invalidPathOptsError = new Error('You must provide appPath and appName values, or a binaryPath value');
          log.error(invalidPathOptsError);
          throw invalidPathOptsError;
        }

        /**
         * download chromedriver if required
         */
        if (shouldDownloadChromedriver) {
          log.debug(`downloading Chromedriver for Electron v${electronVersion}...`);
          await attemptAssetsDownload(electronVersion);
        } else {
          log.debug('WDIO to handle Chromedriver download...');
        }

        cap.browserName = 'chrome';

        const browserVersion = chromiumVersion || cap.browserVersion;
        if (browserVersion) {
          cap.browserVersion = browserVersion;
        }

        cap['goog:chromeOptions'] = getChromeOptions({ binaryPath, appPath, appName, appArgs }, cap);

        const chromedriverOptions = getChromedriverOptions(cap);
        if (!chromiumVersion && Object.keys(chromedriverOptions).length > 0) {
          cap['wdio:chromedriverOptions'] = chromedriverOptions;
        }

        log.debug('setting cap', cap);
      }),
    ).catch((err) => {
      const msg = `Failed setting up Electron session: ${err.stack}`;
      log.error(msg);
      throw new SevereServiceError(msg);
    });
  }

  before(_capabilities: Capabilities.Capabilities, _specs: string[], browser: WebdriverIO.Browser): void {
    const api: ElectronServiceApi = {};
    this.#browser = browser;
    this.#apiCommands.forEach(({ name, bridgeProp }) => {
      log.debug('adding api command for ', name);
      api[name] = {
        value: async (...args: unknown[]) => {
          try {
            return await (browser.executeAsync as WebdriverClientFunc)(callApi, bridgeProp, args);
          } catch (e) {
            throw new Error(`${name} error: ${(e as Error).message}`);
          }
        },
      };
    });

    this.#browser.electron = Object.create({}, api);
  }

  async onPrepare(config: Options.Testrunner, capabilities: Capabilities.RemoteCapabilities): Promise<void> {
    /**
     * pre-configure necessary driver for worker threads
     */
    await Promise.all([setupDriver(config, capabilities), setupBrowser(config, capabilities)]);
  }
}

async function callApi(bridgePropName: string, args: unknown[], done: (result: unknown) => void) {
  if (window.wdioElectron === undefined) {
    throw new Error(`ContextBridge not available for invocation of "${bridgePropName}" API`);
  }
  if (window.wdioElectron[bridgePropName] === undefined) {
    throw new Error(`"${bridgePropName}" API not found on ContextBridge`);
  }
  return done(await window.wdioElectron[bridgePropName].invoke(...args));
}
