import { normalize } from 'node:path';
import type { NormalizedPackageJson } from 'read-package-up';
import type { Plugin } from 'rollup';
import { type InjectDependencyPluginOptions, injectDependency } from './utils';

export const MODULE_TYPE = {
  CJS: 'cjs',
  ESM: 'esm',
} as const;

type UnionizeValue<T> = T[keyof T];
export type SourceCodeType = UnionizeValue<typeof MODULE_TYPE>;

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

const determineTarget = (id: string, target: string) => normalize(id).endsWith(normalize(target));

export const injectDependencyPlugin = (
  options: InjectDependencyPluginOptions | InjectDependencyPluginOptions[],
): Plugin => {
  const pluginOptions = Array.isArray(options) ? options : [options];
  const targetFiles = [...new Set(pluginOptions.map((item) => item.targetFile))];

  return {
    name: 'rollup-wdio-inject-dependency',
    async transform(code, id) {
      const targetFile = targetFiles.find((targetFile) => determineTarget(id, targetFile));
      if (!targetFile) {
        return null;
      }

      const targetOptions = pluginOptions.filter((pluginOption) => pluginOption.targetFile === targetFile);

      let newCode = code;
      for (const targetOption of targetOptions) {
        newCode = await injectDependency.call(this, targetOption, newCode);
      }
      return { code: newCode, map: null };
    },
  };
};

export type CodeReplacePluginOption = {
  id: string;
  searchValue: string | RegExp;
  replaceValue: string;
};

/**
 * Plugin to handle ESM/CJS compatibility issues with certain dependencies.
 * Specifically used to handle @wdio/logger which only supports ESM imports
 * due to its dependency on chalk v5.
 *
 * @see https://github.com/webdriverio-community/wdio-electron-service/issues/944
 */
export const codeReplacePlugin = (options: CodeReplacePluginOption | CodeReplacePluginOption[]): Plugin => {
  const pluginOptions = Array.isArray(options) ? options : [options];
  const targetFiles = [...new Set(pluginOptions.map((item) => item.id))];

  return {
    name: 'rollup-wdio-code-replacer',
    async renderChunk(code, chunk) {
      const facadeModuleId = chunk.facadeModuleId || '';

      const targetFile = targetFiles.find((targetFile) => determineTarget(facadeModuleId, targetFile));
      if (!targetFile) {
        return null;
      }

      const targetOptions = pluginOptions.filter((pluginOption) => pluginOption.id === targetFile);
      let newCode = code;

      for (const targetOption of targetOptions) {
        const oldCode = newCode;
        newCode = oldCode.replace(targetOption.searchValue, targetOption.replaceValue);

        if (newCode === oldCode) {
          this.warn(`No replacements made for pattern in ${targetOption.id}`);
          return null;
        }

        this.info(`Successfully replaced code pattern in ${targetOption.id}`);
      }

      return { code: newCode, map: null };
    },
  };
};

export type { InjectDependencyPluginOptions };
