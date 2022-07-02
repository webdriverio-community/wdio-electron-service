import { join } from 'path';
import { Capabilities } from '@wdio/types';
import { launcher as ChromedriverServiceLauncher, ChromedriverServiceOptions } from 'wdio-chromedriver-service';
import { log } from './utils';

type WdioConfig = {
  [key: string]: unknown;
};

type ElectronLauncherServiceOpts = {
  chromedriver?: ChromedriverServiceOptions;
};

function createChromedriverServiceOptions(
  options: ElectronLauncherServiceOpts,
  resolver: NodeJS.RequireResolve,
): ChromedriverServiceOptions {
  const { chromedriver = {} } = options;
  const chromedriverServiceOptions = { ...chromedriver };

  process.env.WDIO_ELECTRON = 'true';

  if (!chromedriverServiceOptions.chromedriverCustomPath) {
    log.debug('chromedriverCustomPath not set - looking for electron-chromedriver');
    try {
      const electronChromedriverPath = resolver('electron-chromedriver/chromedriver');
      log.debug('electron-chromedriver path found:', electronChromedriverPath);
      chromedriverServiceOptions.chromedriverCustomPath = electronChromedriverPath;
    } catch (e) {
      const electronChromedriverNotFoundError = new Error(
        'electron-chromedriver was not found. You need to install it or provide a binary via the chromedriver.chromedriverCustomPath option.',
      );
      log.error(electronChromedriverNotFoundError);
      throw electronChromedriverNotFoundError;
    }
  }

  return chromedriverServiceOptions;
}

export default class ChromeDriverLauncher extends ChromedriverServiceLauncher {
  constructor(
    options: ElectronLauncherServiceOpts,
    capabilities: Capabilities.Capabilities,
    config: WdioConfig,
    resolver = require.resolve,
  ) {
    log.debug('launcher received options:', options);
    const isWin = process.platform === 'win32';
    const chromedriverServiceOptions = createChromedriverServiceOptions(options, resolver);

    if (isWin) {
      process.env.WDIO_ELECTRON_NODE_PATH = process.execPath;
      process.env.WDIO_ELECTRON_CHROMEDRIVER_PATH = chromedriverServiceOptions.chromedriverCustomPath;
      chromedriverServiceOptions.chromedriverCustomPath = join(__dirname, '..', 'bin', 'chrome-driver.bat');
    }

    log.debug('setting chromedriver service options:', chromedriverServiceOptions);
    super(chromedriverServiceOptions, capabilities, config);
  }
}
