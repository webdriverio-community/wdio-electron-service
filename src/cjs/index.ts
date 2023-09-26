import type { Capabilities, Services } from '@wdio/types';

exports.default = class CJSElectronService {
  private instance?: Promise<Services.ServiceInstance>;

  constructor(options: any, caps: never, config: any) {
    this.instance = (async () => {
      const importPath = '../service.js'
      const { default: ElectronService } = await import(importPath);
      return new ElectronService(options, caps, config);
    })();
  }

  async beforeSession(config: any, capabilities: any, specs: string[], cid: string) {
    const instance = await this.instance;
    return instance?.beforeSession?.(config, capabilities, specs, cid)
  }

  async before(capabilities: Capabilities.Capabilities, specs: string[], browser: WebdriverIO.Browser) {
    const instance = await this.instance;
    return instance?.before?.(capabilities, specs, browser);
  }
};

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
