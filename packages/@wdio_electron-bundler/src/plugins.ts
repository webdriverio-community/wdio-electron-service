import { writeFile } from 'node:fs/promises';
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
export const injectDependencyPlugin = (
  options: InjectDependencyPluginOptions | InjectDependencyPluginOptions[],
): Plugin => {
  const pluginOptions = Array.isArray(options) ? options : [options];
  const injectedMap = new Map();
  return {
    name: 'rollup-wdio-inject-dependency',
    async writeBundle(options, bundle) {
      for (const pluginOption of pluginOptions) {
        const filePath = join(options.dir!, pluginOption.targetFile);
        const contents = injectedMap.has(filePath) ? injectedMap.get(filePath) : bundle[pluginOption.targetFile];
        if (!contents) {
          this.warn(`Injection target does not exist: ${pluginOption.targetFile}`);
          return;
        }
        if (!(`code` in contents)) {
          this.warn(`Injection target is not a chunk file: ${pluginOption.targetFile}`);
          return;
        }
        const code = await injectDependency.call(
          this,
          join(options.dir!, pluginOption.targetFile),
          pluginOption,
          contents.code,
        );
        injectedMap.set(filePath, { code });
      }

      // Write the rendered content to a file
      for (const [filePath, contents] of injectedMap.entries()) {
        await writeFile(filePath, contents.code, 'utf-8');
        this.info(`Successfully wrote bundle file: ${filePath}`);
      }
    },
  };
};

export { type InjectDependencyPluginOptions };
