import { ElectronServiceOptions } from '@repo/types';
import type { Capabilities, Options, Services } from '@wdio/types';

export class CJSElectronLauncher {
  private instance: Promise<Services.ServiceInstance>;

  constructor(options: ElectronServiceOptions, caps: unknown, config: Options.Testrunner) {
    this.instance = import('../launcher.js').then(({ default: Launcher }) => new Launcher(options, caps, config));
  }

  async onPrepare(config: Options.Testrunner, capabilities: Capabilities.TestrunnerCapabilities) {
    const instance = (await this.instance) as Services.ServiceInstance;
    return instance.onPrepare?.(config, capabilities);
  }
}

export class CJSElectronService {
  private instance: Promise<Services.ServiceInstance>;

  constructor(globalOptions: ElectronServiceOptions) {
    this.instance = import('../service.js').then(({ default: Service }) => new Service(globalOptions));
  }

  async beforeSession(
    config: Options.Testrunner,
    capabilities: WebdriverIO.Capabilities,
    specs: string[],
    cid: string,
  ) {
    const instance = (await this.instance) as Services.ServiceInstance;
    return instance.beforeSession?.(config, capabilities, specs, cid);
  }

  async before(capabilities: WebdriverIO.Capabilities, specs: string[], browser: WebdriverIO.Browser) {
    const instance = (await this.instance) as Services.ServiceInstance;
    return instance.before?.(capabilities, specs, browser);
  }
}
