/* eslint-disable @typescript-eslint/ban-ts-comment */
import { writeFile } from 'node:fs/promises';
import type {
  NormalizedOutputOptions,
  OutputBundle,
  PluginContext,
  MinimalPluginContext,
  LogLevel,
  RollupLog,
} from 'rollup';
import { emitPackageJsonPlugin, injectDependencyPlugin, warnToErrorPlugin } from '../src/plugins';
import { join } from 'node:path';

type WriteBundle = (this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle) => Promise<void>;

type GenerateBundle = (this: PluginContext, options: NormalizedOutputOptions) => Promise<void>;

type OnLog = (this: MinimalPluginContext, level: LogLevel, log: RollupLog) => void;

vi.mock('../src/utils', async () => {
  const actualUtils = await vi.importActual<typeof import('../src/utils')>('../src/utils');
  let counter = 0;
  return {
    ...actualUtils,
    injectDependency: vi.fn(async (_templatePath, injectPrams, templateContent) => {
      return `${templateContent}\nconst ${injectPrams.importName} = ${++counter}`;
    }),
  };
});

describe('emitPackageJsonPlugin', () => {
  const context = {
    debug: vi.fn(),
    emitFile: vi.fn(),
  } as unknown as PluginContext;

  it('esm', async () => {
    const plugin = emitPackageJsonPlugin('test-pkg', 'esm');

    await (plugin.generateBundle! as unknown as GenerateBundle).call(context, {
      dir: 'dist',
    } as NormalizedOutputOptions);

    expect(context.emitFile).toHaveBeenCalledTimes(1);
    expect(context.emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'package.json',
      source: '{\n  "name": "test-pkg-esm",\n  "type": "module",\n  "private": true\n}',
    });
  });

  it('cjs', async () => {
    const plugin = emitPackageJsonPlugin('test-pkg', 'cjs');

    await (plugin.generateBundle! as unknown as GenerateBundle).call(context, {
      dir: 'dist',
    } as NormalizedOutputOptions);

    expect(context.emitFile).toHaveBeenCalledTimes(1);
    expect(context.emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'package.json',
      source: '{\n  "name": "test-pkg-cjs",\n  "type": "commonjs",\n  "private": true\n}',
    });
  });

  it('should fail', async () => {
    // @ts-expect-error
    expect(() => emitPackageJsonPlugin('test-pkg', 'zzz')).toThrowError('Invalid type is specified');
  });
});

describe('warnToErrorPlugin', () => {
  const context = {
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as PluginContext;

  it('should fail when warning occurred', async () => {
    const plugin = warnToErrorPlugin();
    (plugin.onLog! as unknown as OnLog).call(context, 'warn', { message: 'message' });
    expect(context.warn).toHaveBeenCalledTimes(1);
    expect(context.error).toHaveBeenCalledTimes(1);
  });
});

describe('injectDependencyPlugin', () => {
  vi.mock('node:fs/promises', () => ({
    writeFile: vi.fn(async () => Promise.resolve()),
  }));

  const context = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as PluginContext;

  it('should success injection', async () => {
    const plugin = injectDependencyPlugin([
      {
        packageName: '@vitest/spy',
        targetFile: 'index.js',
        bundleRegExp: /export/,
        importName: 'spy',
        bundleReplace: (importName: string) => `const ${importName} =`,
      },
      {
        packageName: 'fast-copy',
        targetFile: 'index.js',
        bundleRegExp: /export.*$/m,
        importName: '{ default: copy }',
        bundleReplace: (importName: string) => `const ${importName} = { default: index };`,
      },
    ]);

    await (plugin.writeBundle! as unknown as WriteBundle).call(
      context,
      { dir: 'dist' } as NormalizedOutputOptions,
      { 'index.js': { code: `const a = 1` } } as unknown as OutputBundle,
    );

    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(writeFile).toHaveBeenCalledWith(
      join('dir', 'index.js'),
      'const a = 1\nconst spy = 1\nconst { default: copy } = 2',
      'utf-8',
    );
  });

  it('should cause warning when target file is not bundled', async () => {
    const plugin = injectDependencyPlugin([
      {
        packageName: '@vitest/spy',
        targetFile: 'index.js',
        bundleRegExp: /export/,
        importName: 'spy',
        bundleReplace: (importName: string) => `const ${importName} =`,
      },
    ]);

    await (plugin.writeBundle! as unknown as WriteBundle).call(
      context,
      { dir: 'dist' } as NormalizedOutputOptions,
      { 'notFound.js': { code: `const a = 1` } } as unknown as OutputBundle,
    );
    expect(context.warn).toHaveBeenCalledTimes(1);
  });
  it('should cause warning when target file is not chunk file', async () => {
    const plugin = injectDependencyPlugin({
      packageName: '@vitest/spy',
      targetFile: 'index.js',
      bundleRegExp: /export/,
      importName: 'spy',
      bundleReplace: (importName: string) => `const ${importName} =`,
    });

    await (plugin.writeBundle! as unknown as WriteBundle).call(
      context,
      { dir: 'dist' } as NormalizedOutputOptions,
      { 'index.js': {} } as unknown as OutputBundle,
    );
    expect(context.warn).toHaveBeenCalledTimes(1);
  });
});
