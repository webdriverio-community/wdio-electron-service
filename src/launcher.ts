import fs from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';

import findVersions from 'find-versions';
import { readPackageUp, type NormalizedReadResult } from 'read-pkg-up';
import { SevereServiceError } from 'webdriverio';
import type { Services, Options, Capabilities } from '@wdio/types';

import log from './log.js';
import { getBinaryPath } from './utils.js';
import { getChromeOptions, getChromedriverOptions, getElectronCapabilities } from './capabilities.js';
import { getChromiumVersion } from './versions.js';
import type { ElectronServiceOptions } from './types.js';

const APP_NOT_FOUND_ERROR =
  'Could not find Electron app at %s build with %s!\n' +
  'If the application is not compiled, please do so before running your tests, via `%s`.\n' +
  'Otherwise if the application is compiled at a different location, please specify the `appBinaryPath` option in your capabilities.';

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
        log.debug(`found Electron v${electronVersion} with Chromedriver v${chromiumVersion}`);

        let { appBinaryPath, appArgs } = Object.assign({}, this.#globalOptions, cap['wdio:electronServiceOptions']);
        if (!appBinaryPath) {
          appBinaryPath = await detectBinaryPath(pkg);
        }

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

/**
 * detect the path to the Electron app binary
 * @param pkg result of `readPackageUp`
 * @param p   process object (used for testing purposes)
 * @returns   path to the Electron app binary
 */
export async function detectBinaryPath(pkg: NormalizedReadResult, p = process) {
  const appName: string = pkg.packageJson.productName || pkg.packageJson.build?.productName || pkg.packageJson.name;
  if (!appName) {
    return undefined;
  }

  const isForgeSetup = Boolean(
    pkg.packageJson.config?.forge || Object.keys(pkg.packageJson.devDependencies || {}).includes('@electron-forge/cli'),
  );
  if (isForgeSetup) {
    /**
     * Electron Forge always bundles into an `out` directory, until this PR is merged:
     * https://github.com/electron/forge/pull/2714
     */
    const outDir = path.join(path.dirname(pkg.path), 'out', `${appName}-${p.platform}-${p.arch}`);
    const appPath =
      p.platform === 'darwin'
        ? path.join(outDir, `${appName}.app`, 'Contents', 'MacOS', appName)
        : p.platform === 'win32'
        ? path.join(outDir, `${appName}.exe`)
        : path.join(outDir, appName);
    const appExists = await fs.access(appPath).then(
      () => true,
      () => false,
    );
    if (!appExists) {
      throw new SevereServiceError(
        util.format(APP_NOT_FOUND_ERROR, appPath, 'Electron Forge', 'npx electron-forge make'),
      );
    }
    return appPath;
  }

  const isElectronBuilderSetup = Boolean(
    pkg.packageJson.build?.appId || Object.keys(pkg.packageJson.devDependencies || {}).includes('electron-builder'),
  );
  if (isElectronBuilderSetup) {
    const distDirName = pkg.packageJson.build?.directories?.output || 'dist';
    const appPath = getBinaryPath(path.dirname(pkg.path), appName, distDirName, p);
    const appExists = await fs.access(appPath).then(
      () => true,
      () => false,
    );
    if (!appExists) {
      throw new SevereServiceError(
        util.format(APP_NOT_FOUND_ERROR, appPath, 'Electron Builder', 'npx electron-builder build'),
      );
    }
    return appPath;
  }

  return undefined;
}
