import { Capabilities, Options, Services } from '@wdio/types';
import { Browser } from 'webdriverio';
import { isCI } from 'ci-info';

function getMacExecutableName(appName: string) {
  // https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/macPackager.ts#L390
  return appName.endsWith(' Helper') ? appName.replace(' Helper', '') : appName;
}

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
    darwin: `mac/${appName}.app/Contents/MacOS/${getMacExecutableName(appName)}`,
    linux: `linux-unpacked/${appName}`,
    win32: `win-unpacked/${appName}.exe`,
  };

  const electronPath = pathMap[platform as keyof typeof SupportedPlatform];

  return `${distPath}/${electronPath}`;
}

async function callApi(bridgePropName: string, args: unknown[], done: (result: unknown) => void) {
  if (window.wdioElectron === undefined) {
    throw new Error(`ContextBridge not available for invocation of "${bridgePropName}" API`);
  }
  if (window.wdioElectron[bridgePropName] === undefined) {
    throw new Error(`"${bridgePropName}" API not found on ContextBridge`);
  }
  done(await window.wdioElectron[bridgePropName].invoke(...args));
}

type ElectronWorkerOptions = {
  appPath?: string;
  appName?: string;
  binaryPath?: string;
  customApiBrowserCommand?: string;
  appArgs?: string[];
  newSessionPerTest?: boolean;
};
type ApiCommand = { name: string; bridgeProp: string };
type WebDriverClient = Browser<'async'>;
type WebdriverClientFunc = (this: WebDriverClient, ...args: unknown[]) => Promise<unknown>;

export default class ElectronWorkerService implements Services.ServiceInstance {
  constructor(options: Services.ServiceOption) {
    const apiCommands = [
      { name: '', bridgeProp: 'custom' },
      { name: 'electronApp', bridgeProp: 'app' },
      { name: 'electronMainProcess', bridgeProp: 'mainProcess' },
      { name: 'electronBrowserWindow', bridgeProp: 'browserWindow' },
    ];
    const {
      appPath,
      appName,
      appArgs,
      binaryPath,
      newSessionPerTest = true,
      customApiBrowserCommand = 'electronAPI',
    } = options as ElectronWorkerOptions;
    const validPathOpts = binaryPath !== undefined || (appPath !== undefined && appName !== undefined);

    if (!validPathOpts) {
      throw new Error('You must provide appPath and appName values, or a binaryPath value');
    }

    const customCommandCollision = apiCommands.find(
      (command) => command.name === customApiBrowserCommand,
    ) as ApiCommand;
    if (customCommandCollision) {
      throw new Error(
        `The command "${customCommandCollision.name}" is reserved, please provide a different value for customApiBrowserCommand`,
      );
    } else {
      apiCommands[0].name = customApiBrowserCommand;
    }

    this.options = {
      appPath,
      appName,
      appArgs,
      binaryPath,
      newSessionPerTest,
    };
    this.apiCommands = apiCommands;
  }

  public options;

  public apiCommands;

  beforeSession(_config: Omit<Options.Testrunner, 'capabilities'>, capabilities: Capabilities.Capabilities): void {
    const chromeArgs = [];

    if (isCI) {
      chromeArgs.push('window-size=1280,800');
      chromeArgs.push('blink-settings=imagesEnabled=false');
      chromeArgs.push('enable-automation');
      chromeArgs.push('disable-infobars');
      chromeArgs.push('disable-extensions');

      if (process.platform !== 'win32') {
        chromeArgs.push('no-sandbox');
        chromeArgs.push('disable-gpu');
        chromeArgs.push('disable-dev-shm-usage');
        chromeArgs.push('disable-setuid-sandbox');
      }
    }

    const { appPath, appName, appArgs, binaryPath } = this.options;

    if (appArgs) {
      chromeArgs.push(...appArgs);
    }

    const chromeOptions = {
      binary: binaryPath || getBinaryPath(appPath as string, appName as string),
      args: chromeArgs,
      windowTypes: ['app', 'webview'],
    };

    const isMultiremote = typeof capabilities === 'object' && !Array.isArray(capabilities);
    const isElectron = (cap: Capabilities.Capabilities) => cap?.browserName?.toLowerCase() === 'electron';

    if (isMultiremote) {
      Object.values(capabilities).forEach((cap: { capabilities: Capabilities.Capabilities }) => {
        if (isElectron(cap.capabilities)) {
          cap.capabilities.browserName = 'chrome';
          cap.capabilities['goog:chromeOptions'] = chromeOptions;
        }
      });
    } else if (isElectron(capabilities)) {
      capabilities.browserName = 'chrome';
      capabilities['goog:chromeOptions'] = chromeOptions;
    }
  }

  before(_capabilities: Capabilities.Capabilities, _specs: string[], browser: WebDriverClient): void {
    this.apiCommands.forEach(({ name, bridgeProp }) => {
      browser.addCommand(name, async (...args: unknown[]) => {
        try {
          return await (browser.executeAsync as WebdriverClientFunc)(callApi, bridgeProp, args);
        } catch (e) {
          throw new Error(`${name} error: ${(e as Error).message}`);
        }
      });
    });
  }
}
