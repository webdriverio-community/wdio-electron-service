import { join } from 'path';
import { Services, Capabilities } from '@wdio/types';
import { launcher } from 'wdio-chromedriver-service';

type WdioConfig = {
  [key: string]: unknown;
};

export default class ChromeDriverLauncher extends launcher {
  constructor(
    options: Services.ServiceOption,
    capabilities: Capabilities.Capabilities,
    config: WdioConfig,
    resolver = require.resolve,
  ) {
    if (!options.chromedriverCustomPath) {
      const isWin = process.platform === 'win32';
      let chromedriverCustomPath = resolver('electron-chromedriver/chromedriver');

      if (isWin) {
        process.env.WDIO_ELECTRON_NODE_PATH = process.execPath;
        process.env.WDIO_ELECTRON_CHROMEDRIVER_PATH = resolver('electron-chromedriver/chromedriver');
        chromedriverCustomPath = join(__dirname, '..', 'bin', 'chrome-driver.bat');
      }
      options.chromedriverCustomPath = chromedriverCustomPath;
    }

    /* TODO: re-enable linting on this once the CDS typedefs are released */
    super(options, capabilities, config); // eslint-disable-line
  }
}
