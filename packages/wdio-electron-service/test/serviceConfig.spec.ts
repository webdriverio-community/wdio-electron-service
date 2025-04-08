import { describe, it, expect } from 'vitest';

import { ServiceConfig } from '../src/serviceConfig.js';

import type { Browser as PuppeteerBrowser } from 'puppeteer-core';

class MockServiceConfig extends ServiceConfig {
  get clearMocks() {
    return super.clearMocks;
  }
  get resetMocks() {
    return super.resetMocks;
  }
  get restoreMocks() {
    return super.restoreMocks;
  }
  get useCdpBridge() {
    return super.useCdpBridge;
  }
  get puppeteerBrowser(): PuppeteerBrowser | undefined {
    return super.puppeteerBrowser;
  }
  get cdpOptions() {
    return super.cdpOptions;
  }
  set puppeteerBrowser(puppeteerBrowser: PuppeteerBrowser) {
    super.puppeteerBrowser = puppeteerBrowser;
  }
}

describe('ServiceConfig', () => {
  describe('constructor', () => {
    it.each([
      ['clearMocks', false],
      ['resetMocks', false],
      ['restoreMocks', false],
      ['useCdpBridge', true],
    ] as const)('should set the default value - %s', (option, expected) => {
      const config = new MockServiceConfig({}, {});
      expect(config[option]).toBe(expected);
    });

    it.each([
      ['cdpConnectionTimeout', 'timeout', 10],
      ['cdpConnectionWaitInterval', 'waitInterval', 20],
      ['cdpConnectionRetryCount', 'connectionRetryCount', 30],
    ] as const)('should set the value only when set in the globalOptions - %s', (option, internalOption, expected) => {
      const globalOptions = {
        [option]: expected,
      };
      const config = new MockServiceConfig(globalOptions, {});
      expect(config.cdpOptions).toStrictEqual({ [internalOption]: expected });
    });

    it('should set useCdpBridge to false when passed as a globalOptions', () => {
      const config = new MockServiceConfig({ useCdpBridge: false }, {});
      expect(config.useCdpBridge).toBe(false);
    });

    it('should set and return the globalOptions', () => {
      const globalOptions = { rootDir: '/path/to/my-app' };
      const config = new MockServiceConfig(globalOptions, {});
      expect(config.globalOptions).toStrictEqual(globalOptions);
    });
  });

  it('should set and return the browser', () => {
    const browser = { id: '123' } as unknown as WebdriverIO.Browser;
    const config = new MockServiceConfig({}, {});
    config.browser = browser;
    expect(config.browser).toStrictEqual(browser);
  });

  it('should set and return the puppeteerBrowser', () => {
    const browser = { id: '123' } as unknown as PuppeteerBrowser;
    const config = new MockServiceConfig({}, {});
    config.puppeteerBrowser = browser;
    expect(config.puppeteerBrowser).toStrictEqual(browser);
  });
});
