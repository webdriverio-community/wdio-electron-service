import { existsSync, type PathLike } from 'node:fs';
import { dirname } from 'node:path';
import type { PluginContext } from 'rollup';
import { getInputConfig, getOutDirs, type InjectDependencyPluginOptions, injectDependency } from '../../src/utils.js';
import { getFixturePackagePath } from '../helpers/fixture-utils.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

describe('Utility Functions', () => {
  describe('getInputConfig()', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReset();
    });

    it('should resolve entry points from exports field', () => {
      vi.mocked(existsSync).mockImplementation((path: PathLike) => {
        const normalizedPath = path.toString().replace(/\\/g, '/');
        return (
          normalizedPath.endsWith('src/index.ts') ||
          normalizedPath.endsWith('src/mod1.ts') ||
          normalizedPath.endsWith('src/mod2/index.ts') ||
          normalizedPath.endsWith('src/mod3.mts') ||
          normalizedPath.endsWith('src/mod4/index.mts') ||
          normalizedPath.endsWith('src/mod5/api.cts') ||
          normalizedPath.endsWith('src/mod6/api/index.cts')
        );
      });

      const pkgJsonPath = getFixturePackagePath('build-esm', 'build-test-esm');
      const exports = {
        '.': './dist/loader.js',
        './mod1': './dist/mod1.js',
        './mod2': {
          import: {
            types: './dist/mod2/index.d.ts',
            default: './dist/mod2/index.js',
          },
          require: {
            types: './dist/mod2/index.d.ts',
            default: './dist/mod2/index.js',
          },
        },
        './mod3': {
          import: {
            types: './dist/mod3.d.mts',
            default: './dist/mod3.mjs',
          },
          require: {
            types: './dist/mod3.d.cts',
            default: './dist/mod3.cjs',
          },
        },
        './mod4': './dist/mod4/index.mjs',
        './mod5/api': {
          import: {
            types: './dist/mod5/api.d.mts',
            default: './dist/mod5/api.mjs',
          },
          require: {
            types: './dist/mod5/api.d.cts',
            default: './dist/mod5/api.cjs',
          },
        },
        './mod6/api': {
          import: {
            types: './dist/mod6/api/index.d.cts',
            default: './dist/mod6/api/index.cjs',
          },
          require: {
            types: './dist/mod6/api/index.d.cts',
            default: './dist/mod6/api/index.cjs',
          },
        },
      };

      expect(
        getInputConfig(
          {
            path: pkgJsonPath,
            packageJson: {
              name: 'test',
              version: '0.0.0',
              readme: 'readme.md',
              _id: '',
              exports,
            },
          },
          'src',
        ),
      ).toEqual({
        index: 'src/index.ts',
        mod1: 'src/mod1.ts',
        mod2: 'src/mod2/index.ts',
        mod3: 'src/mod3.mts',
        mod4: 'src/mod4/index.mts',
        'mod5/api': 'src/mod5/api.cts',
        'mod6/api': 'src/mod6/api/index.cts',
      });
    });

    it('should throw an error when exports field is missing', () => {
      expect(() =>
        getInputConfig(
          {
            path: '/path/to/package.json',
            packageJson: {
              name: 'test',
              version: '0.0.0',
              readme: 'readme.md',
              _id: '',
            },
          },
          'src',
        ),
      ).toThrowError(`"exports" field which is required is not set:`);
    });

    it('should throw an error when entry point is not found', () => {
      const exports = {
        '.': {
          import: {
            types: './dist/index.d.mts',
            default: './dist/index.mjs',
          },
          require: {
            types: './dist/index.d.cts',
            default: './dist/index.cjs',
          },
        },
      };
      expect(() =>
        getInputConfig(
          {
            path: '/path/to/package.json',
            packageJson: {
              name: 'test',
              version: '0.0.0',
              readme: 'readme.md',
              _id: '',
              exports,
            },
          },
          'src',
        ),
      ).toThrowError(`entry point is not found: `);
    });

    it('should resolve entry points from nested import/require fields', () => {
      vi.mocked(existsSync).mockImplementation((path: PathLike) => {
        const normalizedPath = path.toString().replace(/\\/g, '/');
        return (
          normalizedPath.endsWith('src/nested.ts') ||
          normalizedPath.endsWith('src/deep.ts') ||
          normalizedPath.endsWith('src/index.ts')
        );
      });

      const exports = {
        '.': './dist/loader.js',
        './nested': './dist/nested.js',
        './deep': './dist/deep.js',
      };

      expect(
        getInputConfig(
          {
            path: '/path/to/package.json',
            packageJson: {
              name: 'test',
              version: '0.0.0',
              readme: 'readme.md',
              _id: '',
              exports,
            },
          },
          'src',
        ),
      ).toEqual({
        index: 'src/index.ts',
        nested: 'src/nested.ts',
        deep: 'src/deep.ts',
      });
    });

    it('should handle entry points with only import field', () => {
      vi.mocked(existsSync).mockImplementation((path: PathLike) => {
        const normalizedPath = path.toString().replace(/\\/g, '/');
        return normalizedPath.endsWith('src/importOnly.ts') || normalizedPath.endsWith('src/index.ts');
      });

      const exports = {
        '.': './dist/loader.js',
        './importOnly': './dist/importOnly.js',
      };

      expect(
        getInputConfig(
          {
            path: '/path/to/package.json',
            packageJson: {
              name: 'test',
              version: '0.0.0',
              readme: 'readme.md',
              _id: '',
              exports,
            },
          },
          'src',
        ),
      ).toEqual({
        index: 'src/index.ts',
        importOnly: 'src/importOnly.ts',
      });
    });

    it('should handle entry points with only require field', () => {
      vi.mocked(existsSync).mockImplementation((path: PathLike) => {
        const normalizedPath = path.toString().replace(/\\/g, '/');
        return normalizedPath.endsWith('src/requireOnly.ts') || normalizedPath.endsWith('src/index.ts');
      });

      const exports = {
        '.': './dist/loader.js',
        './requireOnly': './dist/requireOnly.js',
      };

      expect(
        getInputConfig(
          {
            path: '/path/to/package.json',
            packageJson: {
              name: 'test',
              version: '0.0.0',
              readme: 'readme.md',
              _id: '',
              exports,
            },
          },
          'src',
        ),
      ).toEqual({
        index: 'src/index.ts',
        requireOnly: 'src/requireOnly.ts',
      });
    });
  });

  describe('getOutDirs()', () => {
    const fixturePkgJson = {
      name: 'test-pkg',
      version: '0.0.0',
      readme: 'readme.md',
      _id: '',
      main: './path/to/cjs/index.js',
      module: './path/to/esm/index.js',
      types: './path/to/types/index.d.js',
    };

    it.each(['main', 'module'] as const)('should throw an error when the %s field is missing', (fieldName) => {
      const testPackageJson = Object.assign({}, fixturePkgJson);
      delete testPackageJson[fieldName];

      expect(() =>
        getOutDirs({
          packageJson: testPackageJson,
          path: '/path/to/package.json',
        }),
      ).toThrowError(`"${fieldName}" field which is required is not set:`);
    });

    it('should return correct output directory paths', () => {
      expect(
        getOutDirs({
          packageJson: fixturePkgJson,
          path: '/path/to/package.json',
        }),
      ).toStrictEqual({
        esm: './path/to/esm',
        cjs: './path/to/cjs',
      });
    });
  });

  describe('injectDependency()', () => {
    vi.mock('rollup', async (importOriginal) => {
      const actualRollup = await importOriginal<typeof import('rollup')>();
      return {
        ...actualRollup,
        rollup: vi.fn(async () => ({
          generate: vi.fn(async () => ({
            output: [
              {
                code: 'const obj = {\n  a: 1,\n  b: 2,\n};\n\nexport { obj };\n',
              },
            ],
          })),
        })),
      };
    });

    it('should successfully inject dependency code', async () => {
      const fixture = getFixturePackagePath('build-esm', 'build-test-esm');
      const cwd = dirname(fixture);
      const context = {
        resolve: vi.fn().mockResolvedValue({ id: `${cwd}/src/test.js` }),
        info: vi.fn(),
        error: vi.fn(),
      } as unknown as PluginContext;
      const templateContent = `const obj = await import('./test.js');`;

      const param: InjectDependencyPluginOptions = {
        packageName: './test.js',
        targetFile: 'main.ts',
        bundleRegExp: /export/,
        importName: 'obj',
        bundleReplace: (importName: string) => `const ${importName} =`,
      };

      const code = await injectDependency.call(context, param, templateContent);
      expect(code).toBe('const obj = {\n  a: 1,\n  b: 2,\n};\n\nconst obj = { obj };\n');
    });

    it('should error when the package cannot be resolved', async () => {
      const context = {
        resolve: vi.fn().mockResolvedValue(undefined),
        info: vi.fn(),
        error: vi.fn(),
      } as unknown as PluginContext;

      const templateContent = `const obj = await import('./test.js');`;
      const param: InjectDependencyPluginOptions = {
        packageName: './test.js',
        targetFile: 'main.ts',
        importName: 'obj',
        bundleRegExp: /export/,
        bundleReplace: (importName: string) => `const ${importName} =`,
      };

      await injectDependency.call(context, param, templateContent);
      expect(context.error).toHaveBeenCalled();
    });

    it('should error when injected contents cannot be generated', async () => {
      const fixture = getFixturePackagePath('build-esm', 'build-test-esm');
      const cwd = dirname(fixture);
      const context = {
        resolve: vi.fn().mockResolvedValue({ id: `${cwd}/src/test.js` }),
        info: vi.fn(),
        error: vi.fn(),
      } as unknown as PluginContext;

      const templateContent = `const obj = await import('./test.js');`;
      const param: InjectDependencyPluginOptions = {
        packageName: './test.js',
        targetFile: 'main.ts',
        importName: 'obj',
        bundleRegExp: /xxxxx/,
        bundleReplace: (importName: string) => `const ${importName} =`,
      };

      await injectDependency.call(context, param, templateContent);
      expect(context.error).toHaveBeenCalled();
    });

    it('should error when rendered content cannot be generated', async () => {
      const fixture = getFixturePackagePath('build-esm', 'build-test-esm');
      const cwd = dirname(fixture);
      const context = {
        resolve: vi.fn().mockResolvedValue({ id: `${cwd}/src/test.js` }),
        info: vi.fn(),
        error: vi.fn(),
      } as unknown as PluginContext;

      const templateContent = `const obj = await import('./test.js');`;
      const param: InjectDependencyPluginOptions = {
        packageName: './test.js',
        targetFile: 'main.ts',
        importName: 'xxxxx',
        bundleRegExp: /export/,
        bundleReplace: (importName: string) => `const ${importName} =`,
      };

      await injectDependency.call(context, param, templateContent);
      expect(context.error).toHaveBeenCalled();
    });
  });
});
