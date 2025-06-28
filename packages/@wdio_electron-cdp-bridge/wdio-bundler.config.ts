import type { BundlerConfig } from '@wdio/electron-bundler';

const config: BundlerConfig = {
  transformations: [
    {
      type: 'injectDependency',
      options: {
        packageName: '@vitest/spy',
        targetFile: 'src/mock.ts',
        bundleRegExp: /export/,
        importName: 'spy',
        bundleReplace: (importName) => `const ${importName} =`,
      },
    },
  ],
};

export default config;
