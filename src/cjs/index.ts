import type { Capabilities, Options, Services } from '@wdio/types';
import type { default as LauncherInstance, ElectronLauncherServiceOpts } from '../launcher.js';
import type { default as ServiceInstance } from '../service.js';

exports.default = class CJSElectronService {
  private instance?: ServiceInstance;

  constructor(options: Services.ServiceOption) {
    (async () => {
      const { default: ElectronService } = await import('../service.js');
      this.instance = new ElectronService(options);
    })();
  }

  async beforeSession(config: Omit<Options.Testrunner, 'capabilities'>, capabilities: Capabilities.Capabilities) {
    const instance = await this.instance;
    return instance?.beforeSession(config, capabilities);
  }

  async before(capabilities: Capabilities.Capabilities, specs: string[], browser: WebdriverIO.Browser) {
    const instance = await this.instance;
    return instance?.before(capabilities, specs, browser);
  }
};

exports.launcher = class CJSElectronServiceLauncher {
  private instance?: LauncherInstance;

  constructor(
    options: ElectronLauncherServiceOpts,
    capabilities: Capabilities.Capabilities,
    config: Options.Testrunner,
  ) {
    (async () => {
      const { default: ElectronServiceLauncher } = await import('../launcher.js');
      this.instance = new ElectronServiceLauncher(options, capabilities, config);
    })();
  }

  async onPrepare() {
    const instance = await this.instance;
    return instance?.onPrepare();
  }

  async onComplete() {
    const instance = await this.instance;
    return instance?.onComplete();
  }
};
