import path, { join } from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { Capabilities, Options } from '@wdio/types';
import extractZip from 'extract-zip';
import { downloadArtifact } from '@electron/get';
import {
  launcher as ChromedriverServiceLauncher,
  ServiceOptions as ChromedriverServiceOptions,
} from 'wdio-chromedriver-service';
import { log } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ElectronLauncherServiceOpts = {
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
  log.debug(`Downloading Chromedriver v${version}`);
  try {
    const targetFolder = path.join(__dirname, '..', 'bin');
    const zipPath = await download(version);
    await extractZip(zipPath, { dir: targetFolder });
    const platform = process.env.npm_config_platform || process.platform;
    if (platform !== 'win32') {
      await fs.chmod(path.join(targetFolder, 'chromedriver'), 0o755);
    }
  } catch (err) {
    // attempt to fall back to semver minor
    const parts = version.split('.');
    const baseVersion = `${parts[0]}.${parts[1]}.0`;

    // don't recurse infinitely
    if (baseVersion === version) {
      throw err;
    } else {
      await attemptDownload(baseVersion);
    }
  }
}

function createChromedriverServiceOptions(options: ElectronLauncherServiceOpts): ChromedriverServiceOptions {
  const { chromedriver = {} } = options;
  const chromedriverServiceOptions = { ...chromedriver };

  process.env.WDIO_ELECTRON = 'true';

  return chromedriverServiceOptions;
}

export default class ChromeDriverLauncher extends ChromedriverServiceLauncher {
  private electronVersion;

  constructor(
    options: ElectronLauncherServiceOpts,
    capabilities: Capabilities.Capabilities,
    config: Options.Testrunner,
  ) {
    log.debug('launcher received options:', options);
    process.env.WDIO_ELECTRON = 'true';
    const isWin = process.platform === 'win32';
    const chromedriverServiceOptions = createChromedriverServiceOptions(options);

    if (isWin) {
      process.env.WDIO_ELECTRON_NODE_PATH = process.execPath;
      process.env.WDIO_ELECTRON_CHROMEDRIVER_PATH = chromedriverServiceOptions.chromedriverCustomPath;
      chromedriverServiceOptions.chromedriverCustomPath = join(__dirname, '..', 'bin', 'chrome-driver.bat');
    } else {
      chromedriverServiceOptions.chromedriverCustomPath = join(__dirname, '..', 'bin', 'chromedriver');
    }

    log.debug('setting chromedriver service options:', chromedriverServiceOptions);
    super(chromedriverServiceOptions, capabilities, config);
    this.electronVersion = options.electronVersion;
  }

  async onPrepare() {
    await attemptDownload(this.electronVersion);

    return super.onPrepare();
  }
}
