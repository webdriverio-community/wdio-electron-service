import { Capabilities, Options, Services } from '@wdio/types';
import { Browser } from 'webdriverio';
import { isCI } from 'ci-info';
import { log } from './utils.js';

type WdioElectronWindowObj = {
  [Key: string]: {
    invoke: (...args: unknown[]) => Promise<unknown>;
  };
};

declare global {
  interface Window {
    wdioElectron?: WdioElectronWindowObj;
  }
}

function getMacExecutableName(appName: string) {
  // https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/macPackager.ts#L390
  if (appName.endsWith(' Helper')) {
    return appName.replace(' Helper', '');
  }

  return appName;
}

function getBinaryPath(distPath: string, appName: string) {
  const SupportedPlatform = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'win32',
  };
  const { platform, arch } = process;

  if (!Object.values(SupportedPlatform).includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const pathMap = {
    darwin: `${arch === 'arm64' ? 'mac-arm64' : 'mac'}/${appName}.app/Contents/MacOS/${getMacExecutableName(appName)}`,
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
};
type ApiCommand = { name: string; bridgeProp: string };
type WebDriverClient = Browser;
type WebdriverClientFunc = (this: WebDriverClient, ...args: unknown[]) => Promise<unknown>;
type ElectronServiceApi = Record<string, { value: (...args: unknown[]) => Promise<unknown> }>;

export default class ElectronWorkerService implements Services.ServiceInstance {
  constructor(options: Services.ServiceOption) {
    const apiCommands = [
      { name: '', bridgeProp: 'custom' },
      { name: 'app', bridgeProp: 'app' },
      { name: 'mainProcess', bridgeProp: 'mainProcess' },
      { name: 'browserWindow', bridgeProp: 'browserWindow' },
    ];
    const { appPath, appName, appArgs, binaryPath, customApiBrowserCommand = 'api' } = options as ElectronWorkerOptions;
    const validPathOpts = binaryPath !== undefined || (appPath !== undefined && appName !== undefined);

    if (!validPathOpts) {
      const invalidPathOptsError = new Error('You must provide appPath and appName values, or a binaryPath value');
      log.error(invalidPathOptsError);
      throw invalidPathOptsError;
    }

    const customCommandCollision = apiCommands.find(
      (command) => command.name === customApiBrowserCommand,
    ) as ApiCommand;
    if (customCommandCollision) {
      const customCommandCollisionError = new Error(
        `The command "${customCommandCollision.name}" is reserved, please provide a different value for customApiBrowserCommand`,
      );
      log.error(customCommandCollisionError);
      throw customCommandCollisionError;
    } else {
      apiCommands[0].name = customApiBrowserCommand;
    }

    this.options = {
      appPath,
      appName,
      appArgs,
      binaryPath,
    };
    this.apiCommands = apiCommands;
  }

  public options;

  public apiCommands;

  public _browser?: WebdriverIO.Browser;

  beforeSession(_config: Omit<Options.Testrunner, 'capabilities'>, capabilities: Capabilities.Capabilities): void {
    const chromeArgs: string[] = [];

    if (isCI) {
      chromeArgs.push('window-size=1280,800');
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

    const isMultiremote =
      typeof capabilities === 'object' &&
      !Array.isArray(capabilities) &&
      Object.keys(capabilities).length > 0 &&
      Object.values(capabilities).every((cap) => typeof cap === 'object');
    const isElectron = (cap: Capabilities.Capabilities) => cap?.browserName?.toLowerCase() === 'electron';

    if (isMultiremote) {
      log.debug('setting up multiremote');
      Object.values(capabilities).forEach((cap: { capabilities: Capabilities.Capabilities }) => {
        if (isElectron(cap.capabilities)) {
          cap.capabilities.browserName = 'chrome';
          cap.capabilities['goog:chromeOptions'] = chromeOptions;
        }
      });
    } else {
      capabilities.browserName = 'chrome';
      capabilities['goog:chromeOptions'] = chromeOptions;
    }

    log.debug('setting browser capabilities', capabilities);
  }

  before(_capabilities: Capabilities.Capabilities, _specs: string[], browser: WebdriverIO.Browser): void {
    const api: ElectronServiceApi = {};
    this._browser = browser;
    this.apiCommands.forEach(({ name, bridgeProp }) => {
      log.debug('adding api command for ', name);
      api[name] = {
        value: async (...args: unknown[]) => {
          try {
            return await (browser.executeAsync as WebdriverClientFunc)(callApi, bridgeProp, args);
          } catch (e) {
            throw new Error(`${name} error: ${(e as Error).message}`);
          }
        },
      };
    });

    //@ts-ignore
    this._browser.electron = Object.create({}, api);
  }
}
