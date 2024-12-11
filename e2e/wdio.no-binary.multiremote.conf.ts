import type { WdioElectronConfig } from '@wdio/electron-types';

import { config as baseConfig } from './wdio.no-binary.conf.js';

const exampleDir = process.env.EXAMPLE_DIR || 'forge-esm';
const baseServiceOptions = baseConfig.capabilities[0]['wdio:electronServiceOptions'];

export const config: WdioElectronConfig = {
  ...baseConfig,
  outputDir: `wdio-logs-multiremote-${exampleDir}`,
  specs: ['./test/multiremote/*.spec.ts'],
  capabilities: {
    browserA: {
      capabilities: {
        'browserName': 'electron',
        'wdio:electronServiceOptions': {
          ...baseServiceOptions,
          appArgs: ['browser=A'],
        },
      },
    },
    browserB: {
      capabilities: {
        'browserName': 'electron',
        'wdio:electronServiceOptions': {
          ...baseServiceOptions,
          appArgs: ['browser=B'],
        },
      },
    },
  },
};
