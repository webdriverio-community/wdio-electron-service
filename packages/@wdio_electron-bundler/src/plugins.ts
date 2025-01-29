import { join } from 'node:path';
import type { NormalizedPackageJson } from 'read-package-up';
import { type Plugin } from 'rollup';
import { injectDependency, type InjectDependencyPluginOptions } from './utils';

export const MODULE_TYPE = {
  CJS: 'cjs',
  ESM: 'esm',
} as const;

type UnionizeValue<T> = T[keyof T];
type SourceCodeType = UnionizeValue<typeof MODULE_TYPE>;

const getTypeValue = (type: SourceCodeType) => {
  switch (type) {
    case MODULE_TYPE.CJS:
      return 'commonjs';
    case MODULE_TYPE.ESM:
      return 'module';
    default:
      throw new Error(`Invalid type is specified: ${type}`);
  }
};

export const getPackageJsonSource = (name: NormalizedPackageJson['name'], type: SourceCodeType) => ({
  name: `${name}-${type}`,
  type: getTypeValue(type),
  private: true,
});

export const emitPackageJsonPlugin = (name: NormalizedPackageJson['name'], type: SourceCodeType): Plugin => {
  const source = JSON.stringify(getPackageJsonSource(name, type), null, '  ');

  return {
    name: 'rollup-wdio-emit-package-json',
    generateBundle(options) {
      this.debug(`Emitting package.json for ${name}-${type} in ${options.dir}`);
      this.emitFile({
        type: 'asset',
        fileName: 'package.json',
        source: source,
      });
    },
  };
};

export const warnToErrorPlugin = (): Plugin => {
  return {
    name: 'rollup-wdio-warn-to-error',
    onLog(level, log) {
      if (level === 'warn') {
        this.warn(`Building Rollup produced warnings that need to be resolved.`);
        this.error(log);
      }
    },
  };
};

// Exclude from Unit Test to check with build results of wdio-electron-service package
/* v8 ignore start */
export const injectDependencyPlugin = (
  options: InjectDependencyPluginOptions | InjectDependencyPluginOptions[],
): Plugin => {
  const pluginOption = Array.isArray(options) ? options : [options];
  return {
    name: 'rollup-wdio-inject-dependency',
    async writeBundle(options, bundle) {
      pluginOption.forEach(async (item) => {
        const contents = bundle[item.targetFile];
        if (!contents) {
          this.warn(`Injection target is not exist: ${item.targetFile}`);
          return;
        }
        if (!(`code` in contents)) {
          this.warn(`Injection target is not chunk file: ${item.targetFile}`);
          return;
        }

        await injectDependency.call(this, join(options.dir!, item.targetFile), item, contents.code);
      });
    },
  };
};

export { type InjectDependencyPluginOptions };
/* v8 ignore stop */
