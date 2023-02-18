import { join, extname } from 'path';
import { promises as fs } from 'fs';
import { Capabilities, Options } from '@wdio/types';
import extractZip from 'extract-zip';
import { downloadArtifact } from '@electron/get';
import {
  launcher as ChromedriverServiceLauncher,
  ServiceOptions as ChromedriverServiceOptions,
} from 'wdio-chromedriver-service';
import { getDirname } from 'cross-dirname';

import { log } from './utils.js';

const dirname = getDirname();

export type ElectronLauncherServiceOpts = {
  chromedriver?: ChromedriverServiceOptions;
  electronVersion?: string;
};

function download(version: string) {
  return downloadArtifact({
    version,
    artifactName: 'chromedriver',
    force: process.env.force_no_cache === 'true',
    cacheRoot: process.env.electron_config_cache,
    platform: process.env.npm_config_platform,
    arch: process.env.npm_config_arch,
    // rejectUnauthorized: process.env.npm_config_strict_ssl === 'true',
    // quiet: ['info', 'verbose', 'silly', 'http'].indexOf(process.env.npm_config_loglevel) === -1
  });
}

async function attemptDownload(version = '') {
  log.debug(`downloading Chromedriver for Electron v${version}`);
  try {
    const targetFolder = join(dirname, '..', 'bin');
    const zipPath = await download(version);
    await extractZip(zipPath, { dir: targetFolder });
    const platform = process.env.npm_config_platform || process.platform;
    if (platform !== 'win32') {
      await fs.chmod(join(targetFolder, 'chromedriver'), 0o755);
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
    await attemptDownload(baseVersion);
  }
}

export default class ChromeDriverLauncher extends ChromedriverServiceLauncher {
  private electronVersion;

  constructor(
    options: ElectronLauncherServiceOpts,
    capabilities: Capabilities.Capabilities,
    config: Options.Testrunner,
  ) {
    const isWin = process.platform === 'win32';
    const chromedriverServiceOptions = options.chromedriver || {};

    log.debug('launcher received options:', options);
    process.env.WDIO_ELECTRON = 'true';

    const validChromedriverPath =
      chromedriverServiceOptions.chromedriverCustomPath !== undefined || options.electronVersion !== undefined;
    if (!validChromedriverPath) {
      const invalidChromedriverOptsError = new Error(
        'you must specify the electronVersion, or provide a chromedriverCustomPath value',
      );
      log.error(invalidChromedriverOptsError);
      throw invalidChromedriverOptsError;
    }

    if (isWin) {
      const shouldRunInNode = extname(chromedriverServiceOptions.chromedriverCustomPath || '') === '.js';
      if (shouldRunInNode) {
        process.env.WDIO_ELECTRON_NODE_PATH = process.execPath;
        process.env.WDIO_ELECTRON_CHROMEDRIVER_PATH = chromedriverServiceOptions.chromedriverCustomPath;
        chromedriverServiceOptions.chromedriverCustomPath = join(dirname, '..', 'bin', 'chromedriver.bat');
      }
    }

    if (!chromedriverServiceOptions.chromedriverCustomPath) {
      const chromedriverExecutable = isWin ? 'chromedriver.exe' : 'chromedriver';
      chromedriverServiceOptions.chromedriverCustomPath = join(dirname, '..', 'bin', chromedriverExecutable);
    }

    log.debug('setting chromedriver service options:', chromedriverServiceOptions);
    super(chromedriverServiceOptions, capabilities, config);
    this.electronVersion = options.electronVersion;
  }

  async onPrepare() {
    if (this.electronVersion) {
      await attemptDownload(this.electronVersion);
    }

    return super.onPrepare();
  }
}
