import { join } from 'path';
import { Capabilities } from '@wdio/types';
import { launcher as ChromedriverServiceLauncher, ChromedriverServiceOptions } from 'wdio-chromedriver-service';

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
    try {
      const electronChromeDriverPath = resolver('electron-chromedriver/chromedriver');
      chromedriverServiceOptions.chromedriverCustomPath = electronChromeDriverPath;
    } catch (e) {
      throw new Error(
        'electron-chromedriver was not found. You need to install it or provide a binary via the chromedriver.chromedriverCustomPath option.',
      );
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
    const isWin = process.platform === 'win32';
    const chromedriverServiceOptions = createChromedriverServiceOptions(options, resolver);

    if (isWin) {
      process.env.WDIO_ELECTRON_NODE_PATH = process.execPath;
      process.env.WDIO_ELECTRON_CHROMEDRIVER_PATH = chromedriverServiceOptions.chromedriverCustomPath;
      chromedriverServiceOptions.chromedriverCustomPath = join(__dirname, '..', 'bin', 'chrome-driver.bat');
    }

    super(chromedriverServiceOptions, capabilities, config);
  }
}
