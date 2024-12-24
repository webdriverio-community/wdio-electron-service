import type { NormalizedPackageJson } from 'read-package-up';
import type { Plugin } from 'rollup';

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
    name: 'wdio-emit-package-json',
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
