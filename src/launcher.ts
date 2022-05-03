import { join } from 'path';
import { Capabilities } from '@wdio/types';
import { launcher as ChromedriverServiceLauncher, ChromedriverServiceOptions } from 'wdio-chromedriver-service';

type WdioConfig = {
  [key: string]: unknown;
};

type ElectronLauncherServiceOpts = {
  chromedriver?: Omit<ChromedriverServiceOptions, 'chromedriverCustomPath'>;
};

export default class ChromeDriverLauncher extends ChromedriverServiceLauncher {
  constructor(
    options: ElectronLauncherServiceOpts,
    capabilities: Capabilities.Capabilities,
    config: WdioConfig,
    resolver = require.resolve,
  ) {
    const { chromedriver = {} } = options;
    const isWin = process.platform === 'win32';
    const chromedriverServiceOptions = {
      chromedriverCustomPath: resolver('electron-chromedriver/chromedriver'),
      ...chromedriver,
    };

    if (isWin) {
      process.env.WDIO_ELECTRON_NODE_PATH = process.execPath;
      process.env.WDIO_ELECTRON_CHROMEDRIVER_PATH = chromedriverServiceOptions.chromedriverCustomPath;
      chromedriverServiceOptions.chromedriverCustomPath = join(__dirname, '..', 'bin', 'chrome-driver.bat');
    }

    super(chromedriverServiceOptions, capabilities, config);
  }
}
