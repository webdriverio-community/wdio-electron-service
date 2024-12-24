import { type PartialCompilerOptions } from '@rollup/plugin-typescript';
import { type ExternalsOptions } from 'rollup-plugin-node-externals';

import { getInputConfig, getOutputParams, getPackageJson, resolveConfig } from './utils';

import type { RollupOptions } from 'rollup';
import { createRollupConfig as _createRollupConfig, createCjsOutputConfig, createEsmOutputConfig } from './config';
import { type NormalizedReadResult } from 'read-package-up';

type InitPrams = {
  rootDir?: string;
  srcDir?: string;
  options?: { esm?: BundlerOptions; cjs?: BundlerOptions };
};

type BundlerOptions = {
  rollupOptions?: RollupOptions;
  compilerOptions?: PartialCompilerOptions;
  externalOptions?: ExternalsOptions;
};

export type RollupWdioElectronServiceOptions = Omit<InitPrams, 'rootDir' | 'options'> & BundlerOptions;

export class RollupOptionCreator {
  pkgJson: NormalizedReadResult;
  esmRollupOptions: RollupOptions = {};
  cjsRollupOptions: RollupOptions = {};

  constructor(prams: InitPrams = {}) {
    const a = Object.assign({ options: { esm: {}, cjs: {} } }, prams);
    this.pkgJson = getPackageJson(a.rootDir || process.cwd());
    this.createEsmConfig({ ...prams, ...a.options.esm });
    this.createCjsConfig({ ...prams, ...a.options.cjs });
  }

  protected createEsmConfig(options: RollupWdioElectronServiceOptions = {}) {
    const resolvedOptions = resolveConfig(options);

    this.esmRollupOptions = this.createRollupConfig(createEsmOutputConfig, resolvedOptions);
  }

  protected createCjsConfig(options: RollupWdioElectronServiceOptions = {}) {
    const resolvedOptions = resolveConfig(options);

    this.cjsRollupOptions = this.createRollupConfig(createCjsOutputConfig, resolvedOptions);
  }

  protected createRollupConfig(
    callback: typeof createEsmOutputConfig | typeof createCjsOutputConfig,
    resolvedOptions: Required<RollupWdioElectronServiceOptions>,
  ) {
    return _createRollupConfig(
      getInputConfig(this.pkgJson, resolvedOptions.srcDir),
      callback(getOutputParams(this.pkgJson)),
      resolvedOptions,
    );
  }

  public getConfigs() {
    return [this.esmRollupOptions, this.cjsRollupOptions];
  }
}
