import { type PartialCompilerOptions } from '@rollup/plugin-typescript';
import { type ExternalsOptions } from 'rollup-plugin-node-externals';

import { getConfigPrams, resolveConfig } from './utils';
import debug from './log';

import type { RollupOptions } from 'rollup';
import { createRollupConfig as _createRollupConfig, createCjsOutputConfig, createEsmOutputConfig } from './config';

export type RollupWdioElectronServiceOptions = {
  rootDir?: string;
  srcDir?: string;
  rollupOptions?: RollupOptions;
  compilerOptions?: PartialCompilerOptions;
  externalOptions?: ExternalsOptions;
};

type Configs = ReturnType<typeof getConfigPrams>;

export class RollupOptionCreator {
  esmRollupOptions: RollupOptions = {};
  cjsRollupOptions: RollupOptions = {};

  constructor(options: RollupWdioElectronServiceOptions = {}) {
    debug('Prepare to generate the rollup configuration');
    const resolvedOptions = resolveConfig(options);

    const { inputConfig, outputParams } = getConfigPrams(resolvedOptions);

    debug('Start to generate the ESM rollup configuration');
    this.esmRollupOptions = this.createRollupConfig(inputConfig, outputParams, createEsmOutputConfig, resolvedOptions);
    debug(`Generated the ESM rollup configuration: ${JSON.stringify(this.esmRollupOptions, null, 2)}`);

    debug('Start to generate the CJS rollup configuration');
    this.cjsRollupOptions = this.createRollupConfig(inputConfig, outputParams, createCjsOutputConfig, resolvedOptions);
    debug(`Generated the CJS rollup configuration: ${JSON.stringify(this.cjsRollupOptions, null, 2)}`);
  }

  protected createRollupConfig(
    inputConfig: Record<string, string>,
    outputParams: Configs['outputParams'],
    callback: typeof createEsmOutputConfig | typeof createCjsOutputConfig,
    resolvedOptions: Required<RollupWdioElectronServiceOptions>,
  ) {
    const rollupOptions = _createRollupConfig(
      inputConfig,
      callback(outputParams),
      resolvedOptions.compilerOptions,
      resolvedOptions.externalOptions,
    );
    return Object.assign({}, resolvedOptions.rollupOptions, rollupOptions);
  }

  public getEsmCjsConfig() {
    return [this.esmRollupOptions, this.cjsRollupOptions];
  }
}
