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
      tsconfig: './tsconfig.json',
      compilerOptions: {
        outDir: pkgInfo.outDir.esm,
      },
    }),
    nodeExternals(),
    nodeResolve(),
    injectDependencyPlugin({
      packageName: '@vitest/spy',
      targetFile: 'src/mock.ts',
      bundleRegExp: /export/,
      importName: 'spy',
      bundleReplace: (importName: string) => `const ${importName} =`,
    }),
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
      tsconfig: './tsconfig.json',
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
