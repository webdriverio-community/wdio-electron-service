import {
  nodeExternals,
  typescript,
  emitPackageJsonPlugin,
  readPackageJson,
  warnToErrorPlugin,
  codeReplacePlugin,
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
    /**
     * Plugin to handle ESM/CJS compatibility issues with @wdio/logger.
     * The logger only supports ESM imports due to its dependency on chalk v5.
     *
     * @see https://github.com/webdriverio-community/wdio-electron-service/issues/944
     */
    codeReplacePlugin({
      id: 'src/log.ts',
      searchValue: "var logger = require('@wdio/logger');",
      replaceValue: "import logger from '@wdio/logger';",
    }),
  ],
  strictDeprecations: true,
};

export default [configEsm, configCjs];
