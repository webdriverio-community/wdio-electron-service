import path from 'node:path';
import util from 'node:util';

import findVersions from 'find-versions';
import { readPackageUp, type NormalizedReadResult } from 'read-package-up';
import { SevereServiceError } from 'webdriverio';
import type { Services, Options, Capabilities } from '@wdio/types';

import log from './log.js';
import { getBinaryPath, getAppBuildInfo } from './application.js';
import { getChromeOptions, getChromedriverOptions, getElectronCapabilities } from './capabilities.js';
import { getChromiumVersion } from './versions.js';
import { APP_NOT_FOUND_ERROR, CUSTOM_CAPABILITY_NAME } from './constants.js';
import type { ElectronServiceOptions } from './types.js';

export type ElectronServiceCapabilities = Capabilities.RemoteCapabilities & {
  [CUSTOM_CAPABILITY_NAME]?: ElectronServiceOptions;
};

export default class ElectronLaunchService implements Services.ServiceInstance {
  #globalOptions: ElectronServiceOptions;
  #projectRoot: string;

  constructor(globalOptions: ElectronServiceOptions, _caps: unknown, config: Options.Testrunner) {
    this.#globalOptions = globalOptions;
    this.#projectRoot = config.rootDir || process.cwd();
  }

  async onPrepare(_config: Options.Testrunner, capabilities: ElectronServiceCapabilities) {
    const capsList = Array.isArray(capabilities)
      ? capabilities
      : Object.values(capabilities).map((multiremoteOption) => multiremoteOption.capabilities);

    const caps = capsList.flatMap((cap) => getElectronCapabilities(cap) as WebdriverIO.Capabilities);
    const pkg =
      (await readPackageUp({ cwd: this.#projectRoot })) ||
      ({ packageJson: { dependencies: {}, devDependencies: {} } } as NormalizedReadResult);

    const { dependencies, devDependencies } = pkg.packageJson;
    const pkgElectronVersion =
      dependencies?.electron ||
      devDependencies?.electron ||
      dependencies?.['electron-nightly'] ||
      devDependencies?.['electron-nightly'];
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
        log.debug(`Found Electron v${electronVersion} with Chromedriver v${chromiumVersion}`);

        let { appBinaryPath, appEntryPoint, appArgs } = Object.assign(
          {},
          this.#globalOptions,
          cap[CUSTOM_CAPABILITY_NAME],
        );

        if (appEntryPoint) {
          // appBinaryPath = path.join(this.#projectRoot, 'node_modules', 'wdio-electron-service', 'bin', 'electron.sh');
          // appBinaryPath = path.join(this.#projectRoot, 'node_modules', 'electron', 'node_modules', '.bin', 'electron');
          appBinaryPath = path.join(this.#projectRoot, 'node_modules', '.bin', 'electron');
          // appBinaryPath = path.join(this.#projectRoot, 'test.sh');
          // appArgs = [];
          appArgs = [`--app=${appEntryPoint}`]; // , ...(appArgs || [])
          log.debug('App entry point: ', appEntryPoint, appBinaryPath, appArgs);
        } else if (!appBinaryPath) {
          log.debug('No app binary found');
          try {
            const appBuildInfo = await getAppBuildInfo(pkg);

            try {
              appBinaryPath = await getBinaryPath(pkg.path, appBuildInfo, electronVersion);

              log.debug(`Detected app binary at ${appBinaryPath}`);
            } catch (e) {
              const buildToolName = appBuildInfo.isForge ? 'Electron Forge' : 'electron-builder';
              const suggestedCompileCommand = `npx ${
                appBuildInfo.isForge ? 'electron-forge make' : 'electron-builder build'
              }`;
              throw new Error(util.format(APP_NOT_FOUND_ERROR, appBinaryPath, buildToolName, suggestedCompileCommand));
            }
          } catch (e) {
            log.error(e);
            throw new SevereServiceError((e as Error).message);
          }
        }

        cap.browserName = 'chrome';
        cap['goog:chromeOptions'] = getChromeOptions({ appBinaryPath, appArgs }, cap);

        log.debug('chrome args: ', cap['goog:chromeOptions']['args']);

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

        /**
         * attach custom capability to be able to identify Electron instances
         * in the worker process
         */
        cap[CUSTOM_CAPABILITY_NAME] = cap[CUSTOM_CAPABILITY_NAME] || {};

        log.debug('setting capability', cap);
      }),
    ).catch((err) => {
      const msg = `Failed setting up Electron session: ${err.stack}`;
      log.error(msg);
      throw new SevereServiceError(msg);
    });
  }
}
