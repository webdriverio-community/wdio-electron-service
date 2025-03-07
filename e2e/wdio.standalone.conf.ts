import { config as baseConfig } from './wdio.conf.js';

import type { WdioElectronConfig } from '@wdio/electron-types';

export const config: WdioElectronConfig = {
  ...baseConfig,
  outputDir: 'wdio-standalone-logs',
  specs: ['./test/standalone/*.spec.js', './test/standalone/*.spec.ts'],
  reporters: ['spec'],
};
