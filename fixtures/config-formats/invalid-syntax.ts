// @ts-nocheck
import type { BundlerConfig } from '@wdio/electron-bundler';

const config: BundlerConfig = {
  esm: {
    input: 'src/index.ts'
    // intentional syntax error: missing comma
    output: {
      dir: 'dist/esm',
      format: 'es',
    },
  },
};

export default config;
