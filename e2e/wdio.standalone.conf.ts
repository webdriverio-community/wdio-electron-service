import { config as baseConfig } from './wdio.conf.js';

import type { WdioElectronConfig } from '@wdio/electron-types';
import type { Options, Capabilities } from '@wdio/types';

type WdioConfig = Options.Testrunner & {
  capabilities: Capabilities.ResolvedTestrunnerCapabilities[];
};

export const config: WdioElectronConfig = {
  ...baseConfig,
  outputDir: 'wdio-standalone-logs',
  specs: ['./test/standalone/*.spec.ts'],
};
