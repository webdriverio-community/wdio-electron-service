import util from 'node:util';
import path from 'node:path';

import { readPackageUp, type NormalizedReadResult } from 'read-package-up';
import { SevereServiceError } from 'webdriverio';
import log from '@wdio/electron-utils/log';
import { getAppBuildInfo, getBinaryPath, getElectronVersion } from '@wdio/electron-utils';
import type { Services, Options, Capabilities } from '@wdio/types';
import type { ElectronServiceCapabilities, ElectronServiceGlobalOptions } from '@wdio/electron-types';

import {
  getChromeOptions,
  getChromedriverOptions,
  getConvertedElectronCapabilities,
  getElectronCapabilities,
} from './capabilities.js';
import { getChromiumVersion } from './versions.js';
import { APP_NOT_FOUND_ERROR, CUSTOM_CAPABILITY_NAME } from './constants.js';
import getPort from 'get-port';

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

    const localElectronVersion = await getElectronVersion(pkg);

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
          appArgs = ['--no-sandbox'],
        } = Object.assign({}, this.#globalOptions, cap[CUSTOM_CAPABILITY_NAME]);

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

        log.debug('Setting capability at onPrepare', cap);
      }),
    ).catch((err) => {
      const msg = `Failed setting up Electron session: ${err.stack}`;
      log.error(msg);
      throw new SevereServiceError(msg);
    });
  }

  /**
   * Assigns unique debugging ports to each Electron instance to prevent port conflicts
   * when running multiple Electron instances concurrently.
   *
   * This method runs at the beginning of each worker process and:
   * 1. Dynamically finds available ports using get-port
   * 2. Adds the --inspect flag with the assigned port to each Electron instance
   * 3. Ensures each Electron instance has a unique debugging port
   *
   * This allows for reliable parallel debugging of multiple Electron instances.
   */
  async onWorkerStart(_cid: string, capabilities: WebdriverIO.Capabilities) {
    try {
      const capsList = Array.isArray(capabilities) ? (capabilities as WebdriverIO.Capabilities[]) : [capabilities];
      const caps = capsList.flatMap((cap) => getConvertedElectronCapabilities(cap) as WebdriverIO.Capabilities);

      const portList = await getDebuggerPorts(caps.length);

      await Promise.all(
        caps.map(async (cap, index) => {
          setInspectArg(cap, portList[index]);
        }),
      );
      log.debug('Setting capability at onWorkerStart', caps);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.stack || error.message : String(error);
      const msg = `Failed to assign debugging ports to Electron instances: ${errorMessage}`;
      log.error(msg);
      throw new SevereServiceError(msg);
    }
  }
}

/**
 * Dynamically allocates available ports for Electron debugger instances
 *
 * @param quantity Number of ports needed (one per Electron instance)
 * @returns Array of available port numbers
 */
const getDebuggerPorts = async (quantity: number): Promise<number[]> => {
  return Promise.all(Array.from({ length: quantity }, () => getPort()));
};

/**
 * Configures an Electron capability with the necessary debugging arguments
 * by adding the --inspect flag with the assigned port to chrome options
 *
 * @param cap WebdriverIO capability to modify
 * @param debuggerPort Port number to use for the Node inspector
 */
const setInspectArg = (cap: WebdriverIO.Capabilities, debuggerPort: number) => {
  if (!('goog:chromeOptions' in cap)) {
    cap['goog:chromeOptions'] = { args: [] };
  }
  const chromeOptions = cap['goog:chromeOptions']!;
  if (!('args' in chromeOptions)) {
    chromeOptions.args = [];
  }
  chromeOptions.args!.push(`--inspect=localhost:${debuggerPort}`);
};
