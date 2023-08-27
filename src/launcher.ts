import { join, extname } from 'path';
import { promises as fs } from 'fs';
import { Capabilities, Options } from '@wdio/types';
import extractZip from 'extract-zip';
import { downloadArtifact as downloadElectronAssets } from '@electron/get';
import { getDirname } from 'cross-dirname';

import { log } from './utils.js';

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

    log.debug('setting chromedriver custom path:', options.chromedriverCustomPath);
    this.electronServiceLauncherOptions = options;
    this.shouldDownloadChromedriver = shouldDownloadChromedriver;

    capabilities['wdio:chromedriverOptions'] = {
      binary: options.chromedriverCustomPath,
    } as WebdriverIO.ChromedriverOptions;
  }

  async onPrepare() {
    if (this.shouldDownloadChromedriver) {
      const { electronVersion } = this.electronServiceLauncherOptions;
      await attemptAssetsDownload(electronVersion);
    }
  }
}
