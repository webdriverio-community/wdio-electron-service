import os from 'node:os';
import { CdpBridge } from '@wdio/cdp-bridge';
import { log } from '@wdio/electron-utils';
import { SevereServiceError } from 'webdriverio';

export const getDebuggerEndpoint = (capabilities: WebdriverIO.Capabilities) => {
  log.trace('Try to detect the node debugger endpoint');

  const debugArg = capabilities['goog:chromeOptions']?.args?.find((item) => item.startsWith('--inspect='));
  log.trace(`Detected debugger args: ${debugArg}`);

  const debugUrl = debugArg ? debugArg.split('=')[1] : undefined;
  const [host, strPort] = debugUrl ? debugUrl.split(':') : [];
  const result = { host, port: Number(strPort) };

  if (!result.host || !result.port) {
    throw new SevereServiceError(`Failed to detect the debugger endpoint.`);
  }

  log.trace(`Detected the node debugger endpoint: `, result);
  return result;
};

export class ElectronCdpBridge extends CdpBridge {
  #contextId: number = 0;

  get contextId() {
    return this.#contextId;
  }

  async connect(): Promise<void> {
    log.debug('CdpBridge options:', this.options);

    await super.connect();

    const contextHandler = this.#getContextIdHandler();

    await this.send('Runtime.enable');
    await this.send('Runtime.disable');

    this.#contextId = await contextHandler;

    await this.send('Runtime.evaluate', {
      expression: getInitializeScript(),
      includeCommandLineAPI: true,
      replMode: true,
      contextId: this.#contextId,
    });
  }

  #getContextIdHandler() {
    return new Promise<number>((resolve, reject) => {
      this.on('Runtime.executionContextCreated', (params) => {
        if (params.context.auxData.isDefault) {
          resolve(params.context.id);
        }
      });

      setTimeout(() => {
        const err = new Error('Timeout exceeded to get the ContextId.');
        log.error(err.message);
        reject(err);
      }, this.options.timeout);
    });
  }
}

function getInitializeScript() {
  const scripts = [
    // Add __name to the global object to work around issue with function serialization
    // This enables browser.execute to work with scripts which declare functions (affects TS specs only)
    // https://github.com/webdriverio-community/wdio-electron-service/issues/756
    // https://github.com/privatenumber/tsx/issues/113
    `globalThis.__name = globalThis.__name ?? ((func) => func);`,
    // Add electron to the global object
    `globalThis.electron = require('electron');`,
  ];

  // add because windows is not exposed the process object to global scope
  if (os.type().match('Windows')) {
    scripts.push(`globalThis.process = require('node:process');`);
  }
  return scripts.join('\n');
}
