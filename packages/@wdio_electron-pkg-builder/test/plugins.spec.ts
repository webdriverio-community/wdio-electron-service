/* eslint-disable @typescript-eslint/ban-ts-comment */
import { join, dirname } from 'path';
import { defineConfig, rollup, OutputAsset } from 'rollup';
import { emitPackageJsonPlugin } from '../src/plugins';
import { getFixturePackagePath } from './utils';

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
