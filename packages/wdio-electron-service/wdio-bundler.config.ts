import type { BundlerConfig } from '@wdio/electron-bundler';

const config: BundlerConfig = {
  transformations: [
    {
      type: 'injectDependency',
      options: {
        packageName: '@vitest/spy',
        targetFile: 'src/mock.ts',
        bundleRegExp: /export\s*\{\s*([^}]+)\s*\}\s*;/,
        importName: 'spy',
        bundleReplace: (importName) => `const ${importName} = { $1 };`,
      },
    },
    {
      type: 'injectDependency',
      options: {
        packageName: 'fast-copy',
        targetFile: 'src/service.ts',
        bundleRegExp: /export.*$/m,
        importName: '{ default: copy }',
        bundleReplace: (importName) => `const ${importName} = { default: index };`,
      },
    },
  ],
  cjs: {
    nodeExternals: {
      exclude: 'fast-copy',
    },
  },
};

export default config;
