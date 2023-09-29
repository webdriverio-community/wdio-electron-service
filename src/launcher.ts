import fs from 'node:fs/promises';
import path from 'node:path';

import { SevereServiceError } from 'webdriverio';
import { Services, Options, Capabilities } from '@wdio/types';

import { log } from './utils.js';
import { getChromeOptions, getChromedriverOptions, getElectronCapabilities } from './capabilities.js';
import { getChromiumVersion, parseVersion } from './versions.js';
import type { ElectronServiceOptions } from './types.js';

export default class ElectronWorkerService implements Services.ServiceInstance {
  #globalOptions: ElectronServiceOptions;
  #projectRoot: string;

  constructor(globalOptions: ElectronServiceOptions, _caps: never, config: Options.Testrunner) {
    this.#globalOptions = globalOptions;
    this.#projectRoot = config.rootDir || process.cwd();
  }

  async onPrepare(_: never, capabilities: Capabilities.RemoteCapabilities) {
    const capsList = Array.isArray(capabilities)
      ? (capabilities[0] as Capabilities.MultiRemoteCapabilities).capabilities
        ? ((capabilities as Capabilities.MultiRemoteCapabilities[]).map((cap) => cap.capabilities) as (
            | Capabilities.DesiredCapabilities
            | Capabilities.W3CCapabilities
          )[])
        : (capabilities as (Capabilities.DesiredCapabilities | Capabilities.W3CCapabilities)[])
      : Object.values(capabilities).map((multiremoteOption) => multiremoteOption.capabilities);

    const caps = capsList.map((cap) => getElectronCapabilities(cap) as WebDriver.Capabilities[]).flat();
    const pkgJSON = JSON.parse((await fs.readFile(path.join(this.#projectRoot, 'package.json'), 'utf-8')).toString());
    const { dependencies, devDependencies } = pkgJSON;
    const localElectronVersion = parseVersion(dependencies?.electron || devDependencies?.electron);

    await Promise.all(
      caps.map(async (cap) => {
        const electronVersion = cap.browserVersion || localElectronVersion;
        const chromiumVersion = await getChromiumVersion(electronVersion);
        log.debug(`found Electron v${electronVersion} with Chromedriver v${chromiumVersion}`);

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
}
