import { describe, expect, it } from 'vitest';

import { ServiceConfig } from '../src/serviceConfig.js';

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
  get cdpOptions() {
    return super.cdpOptions;
  }
}

describe('ServiceConfig', () => {
  describe('constructor', () => {
    it.each([
      ['clearMocks', false],
      ['resetMocks', false],
      ['restoreMocks', false],
    ] as const)('should set the default value - %s', (option, expected) => {
      const config = new MockServiceConfig({}, {});
      expect(config[option]).toBe(expected);
    });

    it.each([
      ['cdpBridgeTimeout', 'timeout', 10],
      ['cdpBridgeWaitInterval', 'waitInterval', 20],
      ['cdpBridgeRetryCount', 'connectionRetryCount', 30],
    ] as const)('should set the value only when set in the globalOptions - %s', (option, internalOption, expected) => {
      const globalOptions = {
        [option]: expected,
      };
      const config = new MockServiceConfig(globalOptions, {});
      expect(config.cdpOptions).toStrictEqual({ [internalOption]: expected });
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
});
