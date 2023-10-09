import findVersions from 'find-versions';
import { readPackageUp, type NormalizedReadResult } from 'read-pkg-up';
import { SevereServiceError } from 'webdriverio';
import { Services, Options, Capabilities } from '@wdio/types';

import log from './log.js';
import { getChromeOptions, getChromedriverOptions, getElectronCapabilities } from './capabilities.js';
import { getChromiumVersion } from './versions.js';
import type { ElectronServiceOptions } from './types.js';

export default class ElectronLaunchService implements Services.ServiceInstance {
  #globalOptions: ElectronServiceOptions;
  #projectRoot: string;

  constructor(globalOptions: ElectronServiceOptions, _caps: never, config: Options.Testrunner) {
    this.#globalOptions = globalOptions;
    this.#projectRoot = config.rootDir || process.cwd();
  }

  async onPrepare(_: never, capabilities: Capabilities.RemoteCapabilities) {
    const capsList = Array.isArray(capabilities)
      ? capabilities
      : Object.values(capabilities).map((multiremoteOption) => multiremoteOption.capabilities);

    const caps = capsList.flatMap((cap) => getElectronCapabilities(cap) as WebDriver.Capabilities[]);
    const pkg =
      (await readPackageUp({ cwd: this.#projectRoot })) ||
      ({ packageJson: { dependencies: {}, devDependencies: {} } } as NormalizedReadResult);

    const { dependencies, devDependencies } = pkg.packageJson;
    const pkgElectronVersion = dependencies?.electron || devDependencies?.electron;
    const localElectronVersion = pkgElectronVersion ? findVersions(pkgElectronVersion, { loose: true })[0] : undefined;

    if (!caps.length) {
      const noElectronCapabilityError = new Error('No Electron browser found in capabilities');
      log.error(noElectronCapabilityError);
      throw noElectronCapabilityError;
    }

    await Promise.all(
      caps.map(async (cap) => {
        const electronVersion = cap.browserVersion || localElectronVersion;
        const chromiumVersion = await getChromiumVersion(electronVersion);
        log.debug(`found Electron v${electronVersion} with Chromedriver v${chromiumVersion}`);

        const { appBinaryPath, appArgs } = Object.assign({}, this.#globalOptions, cap['wdio:electronServiceOptions']);

        const invalidPathOpts = appBinaryPath === undefined;
        if (invalidPathOpts) {
          const invalidPathOptsError = new Error(
            'You must provide the appBinaryPath value for all Electron capabilities',
          );
          log.error(invalidPathOptsError);
          throw invalidPathOptsError;
        }

        cap.browserName = 'chrome';
        cap['goog:chromeOptions'] = getChromeOptions({ appBinaryPath, appArgs }, cap);

        const chromedriverOptions = getChromedriverOptions(cap);
        if (!chromiumVersion && Object.keys(chromedriverOptions).length > 0) {
          cap['wdio:chromedriverOptions'] = chromedriverOptions;
        }

        const browserVersion = chromiumVersion || cap.browserVersion;
        if (browserVersion) {
          cap.browserVersion = browserVersion;
        } else if (!cap['wdio:chromedriverOptions']?.binary) {
          const invalidBrowserVersionOptsError = new Error(
            'You must install Electron locally, or provide a custom Chromedriver path / browserVersion value for each Electron capability',
          );
          log.error(invalidBrowserVersionOptsError);
          throw invalidBrowserVersionOptsError;
        }

        log.debug('setting capability', cap);
      }),
    ).catch((err) => {
      const msg = `Failed setting up Electron session: ${err.stack}`;
      log.error(msg);
      throw new SevereServiceError(msg);
    });
  }
}
