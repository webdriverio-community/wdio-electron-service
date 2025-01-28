import { dirname } from 'node:path';

import { readPackageJson, typescript } from '../src/index';
import { getFixturePackagePath } from './utils';
import typescriptPlugin from '@rollup/plugin-typescript';

describe('readPackageJson', () => {
  it('should return 2 configuration objects', () => {
    const fixture = getFixturePackagePath('esm', 'build-success-esm');
    const cwd = dirname(fixture);
    const result = readPackageJson(cwd);

    expect(result.input).toStrictEqual({ index: 'src/index.ts' });
    expect(result.pkgName).toBe('fixture-build-success-esm');
    expect(result.outDir).toStrictEqual({ esm: './dist/es', cjs: './dist/cjs' });
  });
});

describe('typescript', () => {
  vi.mock('@rollup/plugin-typescript', () => ({
    default: vi.fn(() => 'mocked-plugin'),
  }));
  it('should set default parameter', () => {
    const plugin = typescript({
      compilerOptions: {
        outDir: 'path/to/out',
      },
    });
    expect(plugin).toBe('mocked-plugin');

    expect(typescriptPlugin).toHaveBeenCalledWith({
      compilerOptions: {
        outDir: 'path/to/out',
        declaration: true,
        declarationMap: true,
      },
      exclude: ['rollup.config.ts'],
    });
  });

  it.each([
    ['array', ['test.ts']],
    ['single value', 'test.ts'],
  ])('should join the exclude parameter: %s', (_title, exclude) => {
    typescript({
      compilerOptions: {
        outDir: 'path/to/out',
      },
      exclude,
    });
    expect(typescriptPlugin).toHaveBeenCalledWith({
      compilerOptions: {
        outDir: 'path/to/out',
        declaration: true,
        declarationMap: true,
      },
      exclude: ['rollup.config.ts', 'test.ts'],
    });
  });
});
