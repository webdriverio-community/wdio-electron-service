import type { Options } from '@wdio/types';

import { config as baseConfig } from './wdio.conf.js';

export const config: Options.Testrunner = {
  ...baseConfig,
  outputDir: 'wdio-standalone-logs',
  specs: ['./standalone/*.spec.ts'],
};
