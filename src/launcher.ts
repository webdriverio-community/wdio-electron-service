import { join, extname } from 'path';
import { promises as fs } from 'fs';
import { Capabilities, Options } from '@wdio/types';
import extractZip from 'extract-zip';
import { downloadArtifact as downloadElectronAssets } from '@electron/get';
import { getDirname } from 'cross-dirname';

import { log } from './utils.js';

const isMultiremote = (obj: Capabilities.Capabilities) => typeof obj === 'object' && !Array.isArray(obj);
const isChrome = (cap: Capabilities.Capabilities) => cap.browserName && cap.browserName.toLowerCase() === 'chrome';

const dirname = getDirname();

export type ElectronLauncherServiceOpts = {
  chromedriverCustomPath?: string;
  electronVersion?: string;
};

function downloadAssets(version: string) {
  const conf = {
    version,
    artifactName: 'chromedriver',
    force: process.env.force_no_cache === 'true',
    cacheRoot: process.env.electron_config_cache,
    platform: process.env.npm_config_platform,
    arch: process.env.npm_config_arch,
  };
  log.debug('chromedriver download config: ', conf);
  return downloadElectronAssets(conf);
}

async function attemptAssetsDownload(version = '') {
  log.debug(`downloading Chromedriver for Electron v${version}...`);
  try {
    const targetFolder = join(dirname, '..', 'bin');
    const zipPath = await downloadAssets(version);
    log.debug('assets downloaded to ', zipPath);
    await extractZip(zipPath, { dir: targetFolder });
    log.debug('assets extracted');
    const platform = process.env.npm_config_platform || process.platform;
    if (platform !== 'win32') {
      log.debug('setting file permissions...');
      await fs.chmod(join(targetFolder, 'chromedriver'), 0o755);
      log.debug('permissions set');
    }
  } catch (err) {
    // check if there is a semver minor version for fallback
    const parts = version.split('.');
    const baseVersion = `${parts[0]}.${parts[1]}.0`;

    if (baseVersion === version) {
      log.error(`error downloading Chromedriver for Electron v${version}`);
      log.error(err);
      throw err;
    }

    log.warn(`error downloading Chromedriver for Electron v${version}`);
    log.debug('falling back to minor version...');
    await attemptAssetsDownload(baseVersion);
  }
}

export default class ChromeDriverLauncher {
  private electronServiceLauncherOptions;
  private shouldDownloadChromedriver;
  protected capabilities: Capabilities.Capabilities;
  protected chromedriverOptions: WebdriverIO.ChromedriverOptions = {};

  constructor(
    options: ElectronLauncherServiceOpts,
    capabilities: Capabilities.Capabilities,
    _config: Options.Testrunner,
  ) {
    const isWin = process.platform === 'win32';

    log.debug('launcher received options:', options);
    process.env.WDIO_ELECTRON = 'true';

    const validChromedriverPath = options.chromedriverCustomPath !== undefined || options.electronVersion !== undefined;
    if (!validChromedriverPath) {
      const invalidChromedriverOptsError = new Error(
        'You must specify the electronVersion, or provide a chromedriverCustomPath value',
      );
      log.error(invalidChromedriverOptsError);
      throw invalidChromedriverOptsError;
    }

    const shouldDownloadChromedriver = options.electronVersion && !options.chromedriverCustomPath;

    if (isWin) {
      const shouldRunInNode = extname(options.chromedriverCustomPath || '') === '.js';
      if (shouldRunInNode) {
        process.env.WDIO_ELECTRON_NODE_PATH = process.execPath;
        process.env.WDIO_ELECTRON_CHROMEDRIVER_PATH = options.chromedriverCustomPath;
        options.chromedriverCustomPath = join(dirname, '..', 'bin', 'chromedriver.bat');
      }
    }

    if (!options.chromedriverCustomPath) {
      const chromedriverExecutable = isWin ? 'chromedriver.exe' : 'chromedriver';
      options.chromedriverCustomPath = join(dirname, '..', 'bin', chromedriverExecutable);
    }

    this.electronServiceLauncherOptions = options;
    this.shouldDownloadChromedriver = shouldDownloadChromedriver;
    this.capabilities = capabilities;

    this.chromedriverOptions['wdio:chromedriverOptions' as keyof typeof this.chromedriverOptions] = {
      binary: options.chromedriverCustomPath,
    } as any;
    log.debug('setting chromedriver options:', this.chromedriverOptions);
  }

  _mapCapabilities() {
    // TODO: check mapping works with parallel multiremote
    if (isMultiremote(this.capabilities)) {
      for (const cap in this.capabilities) {
        if (
          isChrome(
            (this.capabilities as Capabilities.MultiRemoteCapabilities)[cap].capabilities as Capabilities.Capabilities,
          )
        ) {
          Object.assign((this.capabilities as Capabilities.MultiRemoteCapabilities)[cap], this.chromedriverOptions);
        }
      }
    } else {
      for (const cap of this.capabilities as Capabilities.DesiredCapabilities[]) {
        if (isChrome(cap)) {
          Object.assign(cap, this.chromedriverOptions);
        }
      }
    }
  }

  async onPrepare() {
    if (this.shouldDownloadChromedriver) {
      const { electronVersion } = this.electronServiceLauncherOptions;
      await attemptAssetsDownload(electronVersion);
    }

    this._mapCapabilities();
    log.debug('setting capabilities:', this.capabilities);
  }
}
