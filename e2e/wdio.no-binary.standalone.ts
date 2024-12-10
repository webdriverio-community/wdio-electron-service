import type { WdioElectronConfig } from '@wdio/electron-types';

import { config as baseConfig } from './wdio.no-binary.conf.js';

export const config: WdioElectronConfig = {
  ...baseConfig,
  outputDir: 'wdio-standalone-logs',
  specs: ['./standalone/*.spec.ts'],
};
