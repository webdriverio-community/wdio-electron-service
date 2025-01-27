import type { Options } from '@wdio/types';

import { config as baseConfig } from './wdio.no-binary.conf.js';

export const config: Options.Testrunner = {
  ...baseConfig,
  outputDir: 'wdio-standalone-logs',
  specs: ['./test/standalone/*.spec.ts'],
};
