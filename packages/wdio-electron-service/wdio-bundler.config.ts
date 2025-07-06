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
      exclude: ['fast-copy', '@wdio/electron-utils', '@wdio/electron-cdp-bridge'],
    },
  },
  esm: {
    nodeExternals: {
      exclude: ['@wdio/electron-utils', '@wdio/electron-cdp-bridge'],
    },
  },
};

export default config;
