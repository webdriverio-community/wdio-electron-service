/* eslint-disable @typescript-eslint/ban-ts-comment */
import type {
  NormalizedOutputOptions,
  PluginContext,
  MinimalPluginContext,
  LogLevel,
  RollupLog,
  TransformPluginContext,
  RenderedChunk,
} from 'rollup';
import { codeReplacePlugin, emitPackageJsonPlugin, injectDependencyPlugin, warnToErrorPlugin } from '../src/plugins';

type Transform = (this: TransformPluginContext, code: string, id: string) => Promise<void>;
type RenderChunk = (this: PluginContext, code: string, chunk: RenderedChunk) => Promise<void>;

type GenerateBundle = (this: PluginContext, options: NormalizedOutputOptions) => Promise<void>;

type OnLog = (this: MinimalPluginContext, level: LogLevel, log: RollupLog) => void;

vi.mock('../src/utils', async () => {
  const actualUtils = await vi.importActual<typeof import('../src/utils')>('../src/utils');
  let counter = 0;
  return {
    ...actualUtils,
    injectDependency: vi.fn(async (injectPrams, templateContent) => {
      return `${templateContent}\nconst ${injectPrams.importName} = ${++counter}`;
    }),
  };
});

describe('emitPackageJsonPlugin', () => {
  const context = {
    debug: vi.fn(),
    emitFile: vi.fn(),
  } as unknown as PluginContext;

  it.each([
    ['esm', 'module'],
    ['cjs', 'commonjs'],
  ])('should emit package.json with correct type for %s format', async (format, moduleType) => {
    // @ts-expect-error
    const plugin = emitPackageJsonPlugin('test-pkg', format);

    await (plugin.generateBundle! as unknown as GenerateBundle).call(context, {
      dir: 'dist',
    } as NormalizedOutputOptions);

    expect(context.emitFile).toHaveBeenCalledTimes(1);
    expect(context.emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'package.json',
      source: `{\n  "name": "test-pkg-${format}",\n  "type": "${moduleType}",\n  "private": true\n}`,
    });
  });

  it('should throw an error for invalid package type', async () => {
    // @ts-expect-error
    expect(() => emitPackageJsonPlugin('test-pkg', 'invalid')).toThrowError('Invalid type is specified');
  });
});

describe('warnToErrorPlugin', () => {
  const context = {
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as PluginContext;

  it('should escalate warnings to errors', async () => {
    const plugin = warnToErrorPlugin();
    (plugin.onLog! as unknown as OnLog).call(context, 'warn', { message: 'message' });
    expect(context.warn).toHaveBeenCalledTimes(1);
    expect(context.error).toHaveBeenCalledTimes(1);
  });
});

describe('injectDependencyPlugin', () => {
  const context = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as TransformPluginContext;

  it('should successfully inject dependencies', async () => {
    const plugin = injectDependencyPlugin([
      {
        packageName: '@vitest/spy',
        targetFile: 'src/mock.ts',
        bundleRegExp: /export/,
        importName: 'spy',
        bundleReplace: (importName: string) => `const ${importName} =`,
      },
      {
        packageName: 'fast-copy',
        targetFile: 'src/service.ts',
        bundleRegExp: /export.*$/m,
        importName: '{ default: copy }',
        bundleReplace: (importName: string) => `const ${importName} = { default: index };`,
      },
    ]);

    const result1 = await (plugin.transform as unknown as Transform).call(
      context,
      `const a = 1`,
      '/path/to/src/mock.ts',
    );
    expect(result1).toStrictEqual({ code: 'const a = 1\nconst spy = 1', map: null });

    const result2 = await (plugin.transform as unknown as Transform).call(
      context,
      `const a = 1`,
      '/path/to/src/src/service.ts',
    );
    expect(result2).toStrictEqual({ code: 'const a = 1\nconst { default: copy } = 2', map: null });
  });

  it('should return null when input id is not injection target', async () => {
    const plugin = injectDependencyPlugin({
      packageName: '@vitest/spy',
      targetFile: 'src/mock.ts',
      bundleRegExp: /export/,
      importName: 'spy',
      bundleReplace: (importName: string) => `const ${importName} =`,
    });

    const result1 = await (plugin.transform as unknown as Transform).call(
      context,
      `const a = 1`,
      '/path/to/src/notfound.ts',
    );
    expect(result1).toBeNull();
  });
});

describe('codeReplacePlugin', () => {
  const context = {
    info: vi.fn(),
    warn: vi.fn(),
  } as unknown as TransformPluginContext;

  it('should successfully replace the code', async () => {
    const plugin = codeReplacePlugin([
      {
        id: 'src/log.ts',
        searchValue: "const test = require('test-lib');",
        replaceValue: "import test from 'test-lib';",
      },
      {
        id: 'src/log.ts',
        searchValue: "const sample = require('sample-lib');",
        replaceValue: "import sample from 'sample-lib';",
      },
    ]);
    const result = await (plugin.renderChunk as unknown as RenderChunk).call(
      context,
      ["const test = require('test-lib');", "const sample = require('sample-lib');"].join('\n'),
      { facadeModuleId: '/path/to/src/log.ts' } as RenderedChunk,
    );
    expect(result).toStrictEqual({
      code: ["import test from 'test-lib';", "import sample from 'sample-lib';"].join('\n'),
      map: null,
    });
  });
  it('should call warn when failed to replace the code', async () => {
    const plugin = codeReplacePlugin({
      id: 'src/log.ts',
      searchValue: "const test = require('test-lib');",
      replaceValue: "import test from 'test-lib';",
    });
    const result = await (plugin.renderChunk as unknown as RenderChunk).call(
      context,
      ["const xxx = require('test-lib');", "const yyy = require('sample-lib');"].join('\n'),
      { facadeModuleId: '/path/to/src/log.ts' } as RenderedChunk,
    );
    expect(context.warn).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });
  it('should return null when not match id and configuration of plugin', async () => {
    const plugin = codeReplacePlugin({
      id: 'src/log.ts',
      searchValue: "const test = require('test-lib');",
      replaceValue: "import test from 'test-lib';",
    });
    const result = await (plugin.renderChunk as unknown as RenderChunk).call(
      context,
      ["const xxx = require('test-lib');", "const yyy = require('sample-lib');"].join('\n'),
      { facadeModuleId: '/path/to/src/index.ts' } as RenderedChunk,
    );
    expect(context.warn).toHaveBeenCalledTimes(0);
    expect(context.info).toHaveBeenCalledTimes(0);
    expect(result).toBeNull();
  });
});
