import { type PartialCompilerOptions } from '@rollup/plugin-typescript';

import { getConfigPrams, resolveConfig } from './utils';
import debug from './log';

import type { RollupOptions } from 'rollup';
import { createRollupConfig as _createRollupConfig, createCjsOutputConfig, createEsmOutputConfig } from './config';

export type RollupWdioElectronServiceOptions = {
  rootDir?: string;
  srcDir?: string;
  rollupOptions?: RollupOptions;
  compilerOptions?: PartialCompilerOptions;
};

export const createRollupConfig = (options: RollupWdioElectronServiceOptions = {}) => {
  debug('Prepare to generate the rollup configuration');
  const resolvedOptions = resolveConfig(options);

  const { inputConfig, outputParams } = getConfigPrams(resolvedOptions);

  debug('Start to generate the ESM rollup configuration');
  const esmRollupOptions = _createRollupConfig(
    inputConfig,
    createEsmOutputConfig(outputParams),
    resolvedOptions.compilerOptions,
  );
  const esmConfig = Object.assign({}, resolvedOptions.rollupOptions, esmRollupOptions);
  debug(`Generated the ESM rollup configuration: ${JSON.stringify(esmConfig, null, 2)}`);

  debug('Start to generate the CJS rollup configuration');
  const cjsRollupOptions = _createRollupConfig(
    inputConfig,
    createCjsOutputConfig(outputParams),
    resolvedOptions.compilerOptions,
  );
  const cjsConfig = Object.assign({}, resolvedOptions.rollupOptions, cjsRollupOptions);
  debug(`Generated the CJS rollup configuration: ${JSON.stringify(cjsConfig, null, 2)}`);

  debug('End to generate the rollup configuration');
  return [esmConfig, cjsConfig];
};
