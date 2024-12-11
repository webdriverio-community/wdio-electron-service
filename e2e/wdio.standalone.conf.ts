import type { WdioElectronConfig } from '@wdio/electron-types';

import { config as baseConfig } from './wdio.conf.js';

export const config: WdioElectronConfig = {
  ...baseConfig,
  outputDir: 'wdio-standalone-logs',
  specs: ['./test/standalone/*.spec.ts'],
};
