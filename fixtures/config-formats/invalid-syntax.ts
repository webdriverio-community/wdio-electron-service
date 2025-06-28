import type { BundlerConfig } from '@wdio/electron-bundler';

const config: BundlerConfig = {
  esm: {
    input: 'src/index.ts'
    // Missing comma - syntax error
    output: {
      dir: 'dist/esm',
      format: 'es'
    }
  }
};

export default config;
