/* eslint-disable @typescript-eslint/ban-ts-comment */
import { join, dirname } from 'node:path';
import { defineConfig, rollup, OutputAsset, type RollupOptions } from 'rollup';
import { emitPackageJsonPlugin, warnToErrorPlugin } from '../src/plugins';
import { getFixturePackagePath } from './utils';
import typescript from '@rollup/plugin-typescript';

describe('emitPackageJsonPlugin', () => {
  it('esm', async () => {
    const fixture = getFixturePackagePath('esm', 'build-test-esm');
    const config = defineConfig({
      input: join(dirname(fixture), 'src/index.js'),
      plugins: [emitPackageJsonPlugin('test-pkg', 'esm')],
    });

    const bundle = await rollup(config);
    const result = await bundle.generate({});
    expect(result.output.length).toBe(2);
    const pkg = result.output[1] as OutputAsset;
    expect(JSON.parse(pkg.source as string)).toStrictEqual({
      name: 'test-pkg-esm',
      type: 'module',
      private: true,
    });
  });

  it('cjs', async () => {
    const fixture = getFixturePackagePath('esm', 'build-test-esm');
    const config = defineConfig({
      input: join(dirname(fixture), 'src/index.js'),
      plugins: [emitPackageJsonPlugin('test-pkg', 'cjs')],
    });

    const bundle = await rollup(config);
    const result = await bundle.generate({});
    expect(result.output.length).toBe(2);
    const pkg = result.output[1] as OutputAsset;
    expect(JSON.parse(pkg.source as string)).toStrictEqual({
      name: 'test-pkg-cjs',
      type: 'commonjs',
      private: true,
    });
  });

  it('should fail', async () => {
    const fixture = getFixturePackagePath('esm', 'build-test-esm');
    expect(() =>
      defineConfig({
        input: join(dirname(fixture), 'src/index.js'),
        // @ts-expect-error
        plugins: [emitPackageJsonPlugin('test-pkg', 'zzz')],
      }),
    ).toThrowError('Invalid type is specified');
  });
});

describe('warnToErrorPlugin', () => {
  it('should fail when warning occurred', async () => {
    const fixture = getFixturePackagePath('esm', 'build-success-esm');
    const cwd = dirname(fixture);
    const config: RollupOptions = {
      input: `${cwd}/src/index.ts`,
      output: {
        format: 'esm',
      },
      plugins: [
        typescript({
          compilerOptions: {
            sourceMap: true,
          },
        }),
        warnToErrorPlugin(),
      ],
    };
    const bundle = await rollup(config);
    await expect(() => bundle.generate({})).rejects.toThrowError();
  });
});
