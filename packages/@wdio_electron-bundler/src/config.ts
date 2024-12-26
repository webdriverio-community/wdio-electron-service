import typescript from '@rollup/plugin-typescript';
import type { InputOption, OutputOptions, RollupOptions } from 'rollup';
import nodeExternals from 'rollup-plugin-node-externals';

import debug from './log';
import { getOutputParams } from './utils';
import { emitPackageJsonPlugin, MODULE_TYPE } from './plugins';
import { type RollupWdioElectronServiceOptions } from '.';

type OutputPrams = ReturnType<typeof getOutputParams>;

export const createRollupConfig = (
  input: InputOption,
  output: OutputOptions,
  options: Required<RollupWdioElectronServiceOptions>,
): RollupOptions => {
  const config: RollupOptions = {
    input,
    output,
    plugins: [
      typescript(
        Object.assign({}, options.typescriptOptions, {
          exclude: ['rollup.config.ts'],
          compilerOptions: Object.assign({}, options.typescriptOptions.compilerOptions, {
            outDir: output.dir,
            declaration: true,
            declarationMap: true,
          }),
        }),
      ),
      nodeExternals(Object.assign({}, options.externalOptions)),
    ],
    strictDeprecations: true,
    onwarn: (warning, warn) => {
      warn(`Building Rollup produced warnings that need to be resolved.`);
      throw Object.assign(new Error(), warning);
    },
  };
  debug(`Rollup config created: ${JSON.stringify(config, null, 2)}`);
  return config;
};

export const createEsmOutputConfig = (params: OutputPrams): OutputOptions => {
  return {
    format: MODULE_TYPE.ESM,
    dir: params.esmDir,
    sourcemap: true,
    plugins: [emitPackageJsonPlugin(params.name, MODULE_TYPE.ESM)],
  };
};

export const createCjsOutputConfig = (params: OutputPrams): OutputOptions => {
  return {
    format: MODULE_TYPE.CJS,
    dir: params.cjsDir,
    exports: 'named',
    dynamicImportInCjs: false,
    sourcemap: true,
    plugins: [emitPackageJsonPlugin(params.name, MODULE_TYPE.CJS)],
  };
};
