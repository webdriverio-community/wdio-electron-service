import typescript, { type PartialCompilerOptions } from '@rollup/plugin-typescript';
import type { InputOption, OutputOptions, RollupOptions } from 'rollup';
import { getOutputParams, resolveCompilerOptions } from './utils';
import nodeExternals from 'rollup-plugin-node-externals';
import { emitPackageJsonPlugin, MODULE_TYPE } from './plugins';

type OutputPrams = ReturnType<typeof getOutputParams>;

export const createRollupConfig = (
  input: InputOption,
  output: OutputOptions,
  compilerOptions: PartialCompilerOptions,
): RollupOptions => ({
  input,
  output,
  plugins: [
    typescript({
      exclude: ['rollup.config.ts'],
      compilerOptions: resolveCompilerOptions(
        {
          outDir: output.dir,
          declaration: true,
          declarationMap: true,
        },
        compilerOptions,
      ),
    }),
    nodeExternals(),
  ],
  strictDeprecations: true,
  onwarn: (warning, warn) => {
    warn(`Building Rollup produced warnings that need to be resolved.`);
    throw Object.assign(new Error(), warning);
  },
});

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
