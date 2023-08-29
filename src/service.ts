import { Capabilities, Services } from '@wdio/types';
import { Browser } from 'webdriverio';

import { log } from './utils.js';
import type { ElectronServiceOptions } from './types.js';

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

async function callApi(bridgePropName: string, args: unknown[], done: (result: unknown) => void) {
  if (window.wdioElectron === undefined) {
    throw new Error(`ContextBridge not available for invocation of "${bridgePropName}" API`);
  }
  if (window.wdioElectron[bridgePropName] === undefined) {
    throw new Error(`"${bridgePropName}" API not found on ContextBridge`);
  }
  done(await window.wdioElectron[bridgePropName].invoke(...args));
}

type ApiCommand = { name: string; bridgeProp: string };
type WebDriverClient = Browser;
type WebdriverClientFunc = (this: WebDriverClient, ...args: unknown[]) => Promise<unknown>;
type ElectronServiceApi = Record<string, { value: (...args: unknown[]) => Promise<unknown> }>;

export default class ElectronWorkerService implements Services.ServiceInstance {
  constructor(options: Services.ServiceOption) {
    const apiCommands = [
      { name: '', bridgeProp: 'custom' },
      { name: 'app', bridgeProp: 'app' },
      { name: 'browserWindow', bridgeProp: 'browserWindow' },
      { name: 'dialog', bridgeProp: 'dialog' },
      { name: 'mainProcess', bridgeProp: 'mainProcess' },
      { name: 'mock', bridgeProp: 'mock' },
    ];
    const { appPath, appName, binaryPath, customApiBrowserCommand = 'api' } = options as ElectronServiceOptions;
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
      binaryPath,
    };
    this.apiCommands = apiCommands;
  }

  public options;

  public apiCommands;

  public _browser?: WebdriverIO.Browser;

  // beforeSession(_config: Omit<Options.Testrunner, 'capabilities'>, capabilities: Capabilities.Capabilities): void {
  //   capabilities = mapCapabilities(capabilities, this.options);

  //   log.debug('beforeSession setting capabilities', capabilities, this.options);
  // }

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

    //eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    this._browser.electron = Object.create({}, api);
  }
}
