import { type RollupTypescriptOptions } from '@rollup/plugin-typescript';
import { type ExternalsOptions } from 'rollup-plugin-node-externals';

import { getInputConfig, getOutputParams, getPackageJson, resolveOptions } from './utils';
import { createRollupConfig, createCjsOutputConfig, createEsmOutputConfig } from './config';

import type { RollupOptions } from 'rollup';
import type { NormalizedReadResult } from 'read-package-up';

type InitPrams = {
  rootDir?: string;
  srcDir?: string;
  options?: {
    esm?: RollupWdioElectronServiceOptions;
    cjs?: RollupWdioElectronServiceOptions;
  };
};

export type RollupWdioElectronServiceOptions = {
  typescriptOptions?: RollupTypescriptOptions;
  externalOptions?: ExternalsOptions;
};

export class RollupOptionCreator {
  private pkgJson: NormalizedReadResult;
  esmRollupOptions: RollupOptions = {};
  cjsRollupOptions: RollupOptions = {};
  private inputConfig: Record<string, string>;

  constructor(prams: InitPrams = {}) {
    const options = Object.assign({ esm: {}, cjs: {} }, prams.options);
    this.pkgJson = getPackageJson(prams.rootDir || process.cwd());
    this.inputConfig = getInputConfig(this.pkgJson, prams.srcDir || `src`);

    this.esmRollupOptions = this.createRollupConfig(createEsmOutputConfig, resolveOptions(options.esm));
    this.cjsRollupOptions = this.createRollupConfig(createCjsOutputConfig, resolveOptions(options.cjs));
  }

  protected createRollupConfig(
    createOutputConfig: typeof createEsmOutputConfig | typeof createCjsOutputConfig,
    options: Required<RollupWdioElectronServiceOptions>,
  ) {
    return createRollupConfig(this.inputConfig, createOutputConfig(getOutputParams(this.pkgJson)), options);
  }

  public getConfigs() {
    return [this.esmRollupOptions, this.cjsRollupOptions];
  }
}
