import {
  nodeExternals,
  typescript,
  emitPackageJsonPlugin,
  readPackageJson,
  warnToErrorPlugin,
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
    nodeExternals(),
    warnToErrorPlugin(),
  ],
  strictDeprecations: true,
};

export default [configEsm, configCjs];
