import type { Options } from '@wdio/types';

import { config as baseConfig } from './wdio.conf.js';

console.log('standalone config', baseConfig);

export const config: Options.Testrunner = {
  ...baseConfig,
  outputDir: 'wdio-standalone-logs',
  specs: ['./standalone/*.spec.ts'],
};
