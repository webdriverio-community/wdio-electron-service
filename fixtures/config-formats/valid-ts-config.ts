import type { BundlerConfig } from '@wdio/electron-bundler';

const config: BundlerConfig = {
  esm: {
    input: 'src/index.ts',
    output: {
      dir: 'dist/esm',
      format: 'es',
    },
  },
  cjs: {
    input: 'src/index.ts',
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
    },
  },
};

export default config;
