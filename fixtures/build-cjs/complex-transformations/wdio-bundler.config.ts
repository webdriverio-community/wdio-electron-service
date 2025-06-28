import type { BundlerConfig } from '@wdio/electron-bundler';

const config: BundlerConfig = {
  esm: {
    input: 'src/index.ts',
    output: {
      dir: 'dist/esm',
      format: 'es',
      sourcemap: true,
    },
    nodeExternals: {
      exclude: ['lodash'],
      optionalDependencies: false,
    },
  },
  cjs: {
    input: 'src/index.ts',
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
      sourcemap: true,
    },
    nodeExternals: {
      exclude: ['lodash'],
      optionalDependencies: false,
    },
  },
  transformations: [
    {
      find: /^@\/(.*)$/,
      replacement: new URL('./src/$1', import.meta.url).pathname,
    },
  ],
};

export default config;
