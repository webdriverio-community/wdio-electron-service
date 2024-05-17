import type { Options } from '@wdio/types';
import { config as baseConfig } from './wdio.conf.js';

export const config: Options.Testrunner = {
  ...baseConfig,
  outputDir: 'wdio-multiremote-logs',
  specs: ['./e2e-multiremote/*.ts'],
  capabilities: {
    browserA: {
      capabilities: {
        'browserName': 'electron',
        'wdio:electronServiceOptions': {
          appArgs: ['browser=A'],
        },
      } as WebdriverIO.Capabilities,
    },
    browserB: {
      capabilities: {
        'browserName': 'electron',
        'wdio:electronServiceOptions': {
          appArgs: ['browser=B'],
        },
      } as WebdriverIO.Capabilities,
    },
  },
};
