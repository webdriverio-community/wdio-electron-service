import type { BundlerConfig } from '@wdio/electron-bundler';

const INTERNALS = ['@wdio/electron-utils', '@wdio/electron-cdp-bridge'];

const getExternal = (exclude: string[]) => (id: string) => {
  // Bundle only the internal packages and fast-copy
  if (exclude.some((pkg) => id === pkg || id.startsWith(pkg + '/'))) {
    return false;
  }
  // Externalize everything else (including dependencies of internal packages)
  return /node_modules/.test(id) || /^[^./]/.test(id);
};

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
    external: getExternal(['fast-copy', ...INTERNALS]),
  },
  esm: {
    external: getExternal(INTERNALS),
  },
};

export default config;
