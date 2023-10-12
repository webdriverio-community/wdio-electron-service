import type { Capabilities, Services } from '@wdio/types';

import log from './log.js';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import type { ElectronServiceOptions, ApiCommand, ElectronServiceApi, WebdriverClientFunc } from './types.js';

export default class ElectronWorkerService implements Services.ServiceInstance {
  #browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;
  #apiCommands = [
    { name: '', bridgeProp: 'custom' },
    { name: 'app', bridgeProp: 'app' },
    { name: 'browserWindow', bridgeProp: 'browserWindow' },
    { name: 'dialog', bridgeProp: 'dialog' },
    { name: 'mainProcess', bridgeProp: 'mainProcess' },
    { name: 'mock', bridgeProp: 'mock' },
  ];

  constructor(globalOptions: ElectronServiceOptions) {
    const { customApiBrowserCommand = 'api' } = globalOptions as ElectronServiceOptions;
    const customCommandCollision = this.#apiCommands.find(
      (command) => command.name === customApiBrowserCommand,
    ) as ApiCommand;
    if (customCommandCollision) {
      const customCommandCollisionError = new Error(
        `The command "${customCommandCollision.name}" is reserved, please provide a different value for customApiBrowserCommand`,
      );
      log.error(customCommandCollisionError);
      throw customCommandCollisionError;
    } else {
      this.#apiCommands[0].name = customApiBrowserCommand;
    }
  }

  #getElectronAPI(instance: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser) {
    const api: ElectronServiceApi = {};
    this.#apiCommands.forEach(({ name, bridgeProp }) => {
      log.debug('adding api command for ', name);
      api[name] = {
        value: async (...args: unknown[]) => {
          try {
            return await ((instance as WebdriverIO.Browser).executeAsync as WebdriverClientFunc)(
              callApi,
              bridgeProp,
              args,
            );
          } catch (e) {
            throw new Error(`${name} error: ${(e as Error).message}`);
          }
        },
      };
    });
    return Object.create({}, api);
  }

  before(
    _capabilities: Capabilities.RemoteCapability,
    _specs: string[],
    instance: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): void {
    const browser = instance as WebdriverIO.Browser;
    const mrBrowser = instance as WebdriverIO.MultiRemoteBrowser;
    this.#browser = browser;

    /**
     * add electron API to browser object
     */
    mrBrowser.electron = this.#getElectronAPI(mrBrowser);
    if (this.#browser.isMultiremote) {
      for (const instance of mrBrowser.instances) {
        const mrInstance = mrBrowser.getInstance(instance);
        const caps =
          (mrInstance.requestedCapabilities as Capabilities.W3CCapabilities).alwaysMatch ||
          (mrInstance.requestedCapabilities as WebdriverIO.Capabilities);
        if (!caps[CUSTOM_CAPABILITY_NAME]) {
          continue;
        }
        log.debug('Adding Electron API to browser object instance named: ', instance);
        mrInstance.electron = this.#getElectronAPI(mrInstance);
      }
    }
  }
}

async function callApi(bridgePropName: string, args: unknown[], done: (result: unknown) => void) {
  if (window.wdioElectron === undefined) {
    throw new Error(`ContextBridge not available for invocation of "${bridgePropName}" API`);
  }
  if (window.wdioElectron[bridgePropName] === undefined) {
    throw new Error(`"${bridgePropName}" API not found on ContextBridge`);
  }
  return done(await window.wdioElectron[bridgePropName].invoke(...args));
}
