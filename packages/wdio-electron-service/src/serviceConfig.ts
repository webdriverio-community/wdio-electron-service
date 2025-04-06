import { CUSTOM_CAPABILITY_NAME } from './constants.js';

import type { ElectronServiceGlobalOptions } from '@wdio/electron-types';
import type { Browser as PuppeteerBrowser } from 'puppeteer-core';
import { ElectronCdpBridge } from './bridge.js';

export class ServiceConfig {
  #globalOptions: ElectronServiceGlobalOptions;
  #clearMocks = false;
  #resetMocks = false;
  #restoreMocks = false;
  #browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;
  #puppeteerBrowser?: PuppeteerBrowser;
  #useCdpBridge = true;
  #cdpBridge?: ElectronCdpBridge;

  constructor(globalOptions: ElectronServiceGlobalOptions = {}) {
    this.#globalOptions = globalOptions;
  }

  protected init(capabilities: WebdriverIO.Capabilities) {
    const { clearMocks, resetMocks, restoreMocks, useCdpBridge } = Object.assign(
      {},
      this.#globalOptions,
      capabilities[CUSTOM_CAPABILITY_NAME],
    );

    this.#clearMocks = clearMocks ?? false;
    this.#resetMocks = resetMocks ?? false;
    this.#restoreMocks = restoreMocks ?? false;

    if (typeof useCdpBridge === 'boolean' && !useCdpBridge) {
      this.#useCdpBridge = useCdpBridge;
    }
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

  protected get puppeteerBrowser(): PuppeteerBrowser | undefined {
    return this.#puppeteerBrowser;
  }

  protected set puppeteerBrowser(puppeteerBrowser: PuppeteerBrowser) {
    this.#puppeteerBrowser = puppeteerBrowser;
  }

  protected get cdpBridge(): ElectronCdpBridge | undefined {
    return this.#cdpBridge;
  }

  protected set cdpBridge(cdpBridge: ElectronCdpBridge) {
    this.#cdpBridge = cdpBridge;
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
