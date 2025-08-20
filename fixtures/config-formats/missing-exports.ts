import type { BundlerConfig } from '@wdio/electron-bundler';

// This config has no default export - should cause validation error
export const namedConfig: BundlerConfig = {
  esm: {
    input: 'src/index.ts',
    output: {
      dir: 'dist/esm',
      format: 'es',
    },
  },
};
