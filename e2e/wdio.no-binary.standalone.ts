import { config as baseConfig } from './wdio.no-binary.conf.js';
import type { WdioElectronConfig } from '@wdio/electron-types';

export const config: WdioElectronConfig = {
  ...baseConfig,
  outputDir: 'logs/standalone',
  specs: ['./test/standalone/*.spec.js', './test/standalone/*.spec.ts'],
  reporters: ['spec'],
};
