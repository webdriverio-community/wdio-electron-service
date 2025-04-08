import { CUSTOM_CAPABILITY_NAME } from './constants.js';

import type { ElectronServiceGlobalOptions } from '@wdio/electron-types';
import type { CdpBridgeOptions } from '@wdio/cdp-bridge';

export abstract class ServiceConfig {
  #globalOptions: ElectronServiceGlobalOptions;
  #cdpOptions: CdpBridgeOptions;
  #clearMocks = false;
  #resetMocks = false;
  #restoreMocks = false;
  #browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;
  #useCdpBridge = true;

  constructor(globalOptions: ElectronServiceGlobalOptions = {}, capabilities: WebdriverIO.Capabilities) {
    this.#globalOptions = globalOptions;

    const { clearMocks, resetMocks, restoreMocks } = Object.assign(
      {},
      this.#globalOptions,
      capabilities[CUSTOM_CAPABILITY_NAME],
    );
    this.#clearMocks = clearMocks ?? false;
    this.#resetMocks = resetMocks ?? false;
    this.#restoreMocks = restoreMocks ?? false;

    const { useCdpBridge } = globalOptions;
    if (typeof useCdpBridge === 'boolean' && !useCdpBridge) {
      this.#useCdpBridge = useCdpBridge;
    }

    this.#cdpOptions = {
      ...(globalOptions.cdpConnectionTimeout && { timeout: globalOptions.cdpConnectionTimeout }),
      ...(globalOptions.cdpConnectionWaitInterval && { waitInterval: globalOptions.cdpConnectionWaitInterval }),
      ...(globalOptions.cdpConnectionRetryCount && { connectionRetryCount: globalOptions.cdpConnectionRetryCount }),
    };
  }

  get globalOptions(): ElectronServiceGlobalOptions {
    return this.#globalOptions;
  }

  get browser(): WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser | undefined {
    return this.#browser;
  }

  set browser(browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser) {
    this.#browser = browser;
  }

  protected get cdpOptions(): CdpBridgeOptions {
    return this.#cdpOptions;
  }

  protected get clearMocks() {
    return this.#clearMocks;
  }

  protected get resetMocks() {
    return this.#resetMocks;
  }

  protected get restoreMocks() {
    return this.#restoreMocks;
  }

  protected get useCdpBridge() {
    return this.#useCdpBridge;
  }
}
