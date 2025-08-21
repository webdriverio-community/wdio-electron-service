import {
  nodeExternals,
  typescript,
  emitPackageJsonPlugin,
  readPackageJson,
  warnToErrorPlugin,
  injectDependencyPlugin,
  nodeResolve,
} from '@wdio/electron-bundler';

import type { RollupOptions } from 'rollup';

const pkgInfo = readPackageJson();

const configEsm: RollupOptions = {
  input: pkgInfo.input,
  output: {
    format: 'esm',
    dir: pkgInfo.outDir.esm,
    sourcemap: true,
    plugins: [emitPackageJsonPlugin(pkgInfo.pkgName, 'esm')],
  },
  plugins: [
    typescript({
      compilerOptions: {
        outDir: pkgInfo.outDir.esm,
      },
    }),
    nodeExternals(),
    nodeResolve(),
    injectDependencyPlugin([
      {
        packageName: '@vitest/spy',
        targetFile: 'src/mock.ts',
        bundleRegExp: /export\s*\{\s*([^}]+)\s*\}\s*;/,
        importName: 'spy',
        bundleReplace: (importName: string) => `const ${importName} = { $1 };`,
      },
      {
        packageName: 'fast-copy',
        targetFile: 'src/serviceCdp.ts',
        bundleRegExp: /export.*$/m,
        importName: '{ default: copy }',
        bundleReplace: (importName: string) => `const ${importName} = { default: index };`,
      },
    ]),
    warnToErrorPlugin(),
  ],
  strictDeprecations: true,
};

const configCjs: RollupOptions = {
  input: pkgInfo.input,
  output: {
    format: 'cjs',
    dir: pkgInfo.outDir.cjs,
    exports: 'named',
    dynamicImportInCjs: false,
    sourcemap: true,
    plugins: [emitPackageJsonPlugin(pkgInfo.pkgName, 'cjs')],
  },
  plugins: [
    typescript({
      compilerOptions: {
        outDir: pkgInfo.outDir.cjs,
      },
    }),
    nodeExternals({
      exclude: 'fast-copy',
    }),
    nodeResolve(),
    warnToErrorPlugin(),
  ],
  strictDeprecations: true,
};

export default [configEsm, configCjs];
