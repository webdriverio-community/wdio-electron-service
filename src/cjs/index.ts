import type { Capabilities, Services, Options } from '@wdio/types';
import type { ElectronServiceOptions } from '../types.js';

exports.default = class CJSElectronService {
  private instance?: Promise<Services.ServiceInstance>;

  constructor(options: ElectronServiceOptions, caps: never, config: Options.Testrunner) {
    this.instance = (async () => {
      const importPath = '../service.js';
      const { default: ElectronService } = await import(importPath);
      return new ElectronService(options, caps, config);
    })();
  }

  async beforeSession(config: Options.Testrunner, capabilities: Capabilities.Capabilities, specs: string[], cid: string) {
    const instance = await this.instance;
    return instance?.beforeSession?.(config, capabilities, specs, cid);
  }

  async before(capabilities: Capabilities.Capabilities, specs: string[], browser: WebdriverIO.Browser) {
    const instance = await this.instance;
    return instance?.before?.(capabilities, specs, browser);
  }
};

exports.launcher = class CJSElectronLauncher {
  private instance?: Promise<Services.ServiceInstance>;
  constructor(options: ElectronServiceOptions, caps: never, config: Options.Testrunner) {
    this.instance = (async () => {
      const importPath = '../service.js';
      const { default: ElectronService } = await import(importPath);
      return new ElectronService(options, caps, config);
    })();
  }

  async onPrepare(config: Options.Testrunner, capabilities: Capabilities.RemoteCapabilities) {
    const instance = await this.instance;
    return instance?.onPrepare?.(config, capabilities);
  }
}

export interface BrowserExtension {
  electron: {
    api: (...arg: unknown[]) => Promise<unknown>;
    app: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
    mainProcess: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
    browserWindow: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
    dialog: (funcName: string, ...arg: unknown[]) => Promise<unknown>;
  };
}

declare global {
  namespace WebdriverIO {
    interface Browser extends BrowserExtension {}
    interface MultiRemoteBrowser extends BrowserExtension {}
  }
}
