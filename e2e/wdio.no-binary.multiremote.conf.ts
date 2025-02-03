import type { WdioElectronConfig } from '@wdio/electron-types';

import { config as baseConfig } from './wdio.no-binary.conf.js';

const exampleDir = process.env.EXAMPLE_DIR || 'forge-esm';
const baseServiceOptions = baseConfig.capabilities[0]['wdio:electronServiceOptions'];

const isSplashEnabled = Boolean(process.env.ENABLE_SPLASH_WINDOW);
const specs = isSplashEnabled ? ['./test/window/window.multiremote.spec.ts'] : ['./test/multiremote/*.spec.ts'];

export const config: WdioElectronConfig = {
  ...baseConfig,
  outputDir: `wdio-logs-multiremote-${exampleDir}`,
  specs,
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
