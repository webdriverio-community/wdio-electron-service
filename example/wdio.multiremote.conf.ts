import type { Options } from '@wdio/types';
import { config as baseConfig } from './wdio.conf.js';

export const config: Options.Testrunner = {
  ...baseConfig,
  specs: ['./multiremote/*.ts'],
  capabilities: {
    browserA: {
      capabilities: {
        browserName: 'electron',
      },
    },
    browserB: {
      capabilities: {
        browserName: 'electron',
      },
    },
  },
};
