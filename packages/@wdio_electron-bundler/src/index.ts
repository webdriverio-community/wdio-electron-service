import typescriptPlugin, { type RollupTypescriptOptions } from '@rollup/plugin-typescript';
import { getInputConfig, getPackageJson, getOutDirs } from './utils';

export { nodeExternals } from 'rollup-plugin-node-externals';
export { nodeResolve } from '@rollup/plugin-node-resolve';
export {
  emitPackageJsonPlugin,
  warnToErrorPlugin,
  injectDependencyPlugin,
  type InjectDependencyPluginOptions,
} from './plugins';

export const typescript = (options: RollupTypescriptOptions = {}) => {
  let exclude: string[] = [];

  if (options.exclude) {
    exclude = Array.isArray(options.exclude) ? options.exclude : [options.exclude];
  }

  return typescriptPlugin(
    Object.assign({}, options, {
      exclude: ['rollup.config.ts', ...exclude],
      compilerOptions: Object.assign({}, options.compilerOptions, {
        declaration: true,
        declarationMap: true,
      }),
    }),
  );
};

export const readPackageJson = (cwd = process.cwd()) => {
  const pkg = getPackageJson(cwd);
  const input = getInputConfig(pkg, 'src');
  return {
    input,
    pkgName: pkg.packageJson.name,
    outDir: getOutDirs(pkg),
  };
};
