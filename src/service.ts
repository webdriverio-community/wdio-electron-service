import type { Capabilities, Services } from '@wdio/types';

import log from './log.js';
import type { ElectronServiceOptions, ApiCommand, ElectronServiceApi, WebdriverClientFunc } from './types.js';

export default class ElectronWorkerService implements Services.ServiceInstance {
  #browser?: WebdriverIO.Browser;
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

  before(_capabilities: Capabilities.RemoteCapability, _specs: string[], browser: WebdriverIO.Browser): void {
    const api: ElectronServiceApi = {};
    this.#browser = browser;
    this.#apiCommands.forEach(({ name, bridgeProp }) => {
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

    this.#browser.electron = Object.create({}, api);
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
