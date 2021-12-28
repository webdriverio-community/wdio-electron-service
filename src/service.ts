import { Capabilities, Options, Services } from '@wdio/types';

function getBinaryPath(distPath: string, appName: string) {
  const SupportedPlatform = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'win32',
  };

  if (!Object.values(SupportedPlatform).includes(process.platform)) {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }

  const pathMap = {
    darwin: `mac/${appName}.app/Contents/MacOS/${appName}`,
    linux: `linux-unpacked/${appName}`,
    win32: `win-unpacked/${appName}.exe`,
  };

  const electronPath = pathMap[process.platform as keyof typeof SupportedPlatform];

  return `${distPath}/${electronPath}`;
}

export type ChromeOptions = {
  binary: string;
  args: string[];
  windowTypes: ['app', 'webview'];
};

export type Config = {
  outputDir: string;
};

export default class ElectronWorkerService implements Services.ServiceInstance {
  constructor(options: Services.ServiceOption) {
    this.options = options;
  }

  public options;

  beforeSession(config: Omit<Options.Testrunner, 'capabilities'>, capabilities: Capabilities.Capabilities): void {
    const chromeArgs = [];

    if (process.env.CI) {
      chromeArgs.push('window-size=1280,800');
      chromeArgs.push('blink-settings=imagesEnabled=false');
      chromeArgs.push('enable-automation');
      chromeArgs.push('disable-infobars');
      chromeArgs.push('disable-extensions');
      if (process.platform !== 'win32') {
        // chromeArgs.push('headless'); - crashes on linux with xvfb
        chromeArgs.push('no-sandbox');
        chromeArgs.push('disable-gpu');
        chromeArgs.push('disable-dev-shm-usage');
        chromeArgs.push('disable-setuid-sandbox');
        // chromeArgs.push('remote-debugging-port=9222');
      }
    }

    const { appPath, appName } = this.options;

    capabilities.browserName = 'chrome';
    capabilities['goog:chromeOptions'] = {
      binary: getBinaryPath(appPath as string, appName as string),
      args: chromeArgs,
      windowTypes: ['app', 'webview'],
    };
  }

  async afterTest(): Promise<void> {
    await browser?.reloadSession();
  }
}
