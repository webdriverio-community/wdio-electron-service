import { Capabilities, Options, Services } from '@wdio/types';
import { isCI } from 'ci-info';

function getBinaryPath(distPath: string, appName: string) {
  const SupportedPlatform = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'win32',
  };
  const { platform } = process;

  if (!Object.values(SupportedPlatform).includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const pathMap = {
    darwin: `mac/${appName}.app/Contents/MacOS/${appName}`,
    linux: `linux-unpacked/${appName}`,
    win32: `win-unpacked/${appName}.exe`,
  };

  const electronPath = pathMap[platform as keyof typeof SupportedPlatform];

  return `${distPath}/${electronPath}`;
}

type ElectronWorkerOptions = {
  appPath?: string;
  appName?: string;
  binaryPath?: string;
  appArgs?: string[];
};

export default class ElectronWorkerService implements Services.ServiceInstance {
  constructor(options: Services.ServiceOption) {
    const { appPath, appName, binaryPath } = options;
    const validPathOpts = binaryPath !== undefined || (appPath !== undefined && appName !== undefined);

    if (!validPathOpts) {
      throw new Error('You must provide appPath and appName values, or a binaryPath value');
    }

    this.options = options;
  }

  public options;

  beforeSession(config: Omit<Options.Testrunner, 'capabilities'>, capabilities: Capabilities.Capabilities): void {
    const chromeArgs = [];

    if (isCI) {
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

    const { appPath, appName, appArgs, binaryPath } = this.options as ElectronWorkerOptions;

    if (appArgs) {
      chromeArgs.push(...appArgs);
    }

    capabilities.browserName = 'chrome';
    capabilities['goog:chromeOptions'] = {
      binary: binaryPath || getBinaryPath(appPath as string, appName as string),
      args: chromeArgs,
      windowTypes: ['app', 'webview'],
    };
  }

  async afterTest(): Promise<void> {
    await browser?.reloadSession();
  }
}
