import { dirname } from 'node:path';
import typescriptPlugin from '@rollup/plugin-typescript';
import { readPackageJson, typescript } from '../../src/index.js';
import { getFixturePackagePath } from '../helpers/fixture-utils.js';

describe('Bundler Utilities', () => {
  describe('readPackageJson()', () => {
    it('should return input configuration and output directories', () => {
      const fixture = getFixturePackagePath('build-esm', 'build-test-esm');
      const cwd = dirname(fixture);
      const result = readPackageJson(cwd);

      expect(result.input).toStrictEqual({ index: 'src/index.ts' });
      expect(result.pkgName).toBe('fixture-esm_builder-dependency-cjs-config');
      expect(result.outDir).toStrictEqual({ esm: './dist/es', cjs: './dist/cjs' });
    });
  });

  describe('typescript()', () => {
    vi.mock('@rollup/plugin-typescript', () => ({
      default: vi.fn(() => 'mocked-plugin'),
    }));

    it('should apply default TypeScript configuration', () => {
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
      ['array of files', ['test.ts']],
      ['single file', 'test.ts'],
    ])('should merge exclude patterns when given %s', (_type, exclude) => {
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
});
