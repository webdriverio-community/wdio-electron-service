import util from 'node:util';
import path from 'node:path';

import { readPackageUp, type NormalizedReadResult } from 'read-package-up';
import { SevereServiceError } from 'webdriverio';
import log from '@wdio/electron-utils/log';
import { getAppBuildInfo, getBinaryPath, getElectronVersion } from '@wdio/electron-utils';
import type { Services, Options, Capabilities } from '@wdio/types';
import type { ElectronServiceCapabilities, ElectronServiceGlobalOptions } from '@wdio/electron-types';

import { getChromeOptions, getChromedriverOptions, getElectronCapabilities } from './capabilities.js';
import { getChromiumVersion } from './versions.js';
import { APP_NOT_FOUND_ERROR, CUSTOM_CAPABILITY_NAME } from './constants.js';

export default class ElectronLaunchService implements Services.ServiceInstance {
  #globalOptions: ElectronServiceGlobalOptions;
  #projectRoot: string;

  constructor(globalOptions: ElectronServiceGlobalOptions, _caps: unknown, config: Options.Testrunner) {
    this.#globalOptions = globalOptions;
    this.#projectRoot = globalOptions.rootDir || config.rootDir || process.cwd();
  }

  async onPrepare(_config: Options.Testrunner, capabilities: ElectronServiceCapabilities) {
    const capsList = Array.isArray(capabilities)
      ? capabilities
      : Object.values(capabilities as Capabilities.RequestedMultiremoteCapabilities).map(
          (multiremoteOption) => (multiremoteOption as Capabilities.WithRequestedCapabilities).capabilities,
        );

    const caps = capsList.flatMap((cap) => getElectronCapabilities(cap) as WebdriverIO.Capabilities);
    const pkg =
      (await readPackageUp({ cwd: this.#projectRoot })) ||
      ({ packageJson: { dependencies: {}, devDependencies: {} } } as NormalizedReadResult);

    if (!caps.length) {
      const noElectronCapabilityError = new Error('No Electron browser found in capabilities');
      log.error(noElectronCapabilityError);
      throw noElectronCapabilityError;
    }

    const localElectronVersion = getElectronVersion(pkg);

    await Promise.all(
      caps.map(async (cap) => {
        const electronVersion = cap.browserVersion || localElectronVersion || '';
        const chromiumVersion = await getChromiumVersion(electronVersion);
        log.info(`Found Electron v${electronVersion} with Chromedriver v${chromiumVersion}`);

        if (Number.parseInt(electronVersion.split('.')[0]) < 26 && !cap['wdio:chromedriverOptions']?.binary) {
          const invalidElectronVersionError = new SevereServiceError(
            'Electron version must be 26 or higher for auto-configuration of Chromedriver.  If you want to use an older version of Electron, you must configure Chromedriver manually using the wdio:chromedriverOptions capability',
          );
          log.error(invalidElectronVersionError.message);
          throw invalidElectronVersionError;
        }

        let {
          appBinaryPath,
          appEntryPoint,
          appArgs = [],
        } = Object.assign({}, this.#globalOptions, cap[CUSTOM_CAPABILITY_NAME]);

        const noSandbox = '--no-sandbox';
        if (!appArgs.includes(noSandbox)) {
          appArgs.push(noSandbox);
        }

        if (appEntryPoint) {
          if (appBinaryPath) {
            log.warn('Both appEntryPoint and appBinaryPath are set, appBinaryPath will be ignored');
          }
          const electronBinary = process.platform === 'win32' ? 'electron.CMD' : 'electron';
          appBinaryPath = path.join(this.#projectRoot, 'node_modules', '.bin', electronBinary);
          appArgs = [`--app=${appEntryPoint}`, ...appArgs];
          log.debug('App entry point: ', appEntryPoint, appBinaryPath, appArgs);
        } else if (!appBinaryPath) {
          log.info('No app binary specified, attempting to detect one...');
          try {
            const appBuildInfo = await getAppBuildInfo(pkg);

            try {
              appBinaryPath = await getBinaryPath(pkg.path, appBuildInfo, electronVersion);

              log.info(`Detected app binary at ${appBinaryPath}`);
            } catch (_e) {
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

        // disable WebDriver Bidi session
        cap['wdio:enforceWebDriverClassic'] = true;

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
