import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

import { resolveCompilerOptions, getConfigPrams, getInputConfig, getOutputParams, resolveConfig } from '../src/utils';
import { getFixturePackagePath } from './utils';

const mocks = vi.hoisted(() => {
  return {
    existsSync: vi.fn(),
  };
});

vi.mock('node:fs', () => {
  return {
    existsSync: mocks.existsSync,
  };
});

describe(`getInputConfig`, () => {
  it('should resolved entry point', () => {
    const pkgJsonPath = '/path/to/package.json';
    const rootDir = dirname(pkgJsonPath);

    vi.mocked(existsSync).mockImplementation((path) => {
      return [
        `${rootDir}/src/index.ts`,
        `${rootDir}/src/cjs.ts`,
        `${rootDir}/src/cjs/api.mts`,
        `${rootDir}/src/esm/index.ts`,
        `${rootDir}/src/esm/api/index.mts`,
        `${rootDir}/src/esm/api1/index.cts`,
      ].includes(path as string);
    });
    const exports = {
      '.': './dist/loader.mjs',
      './cjs': './dist/cjs/index.cjs',
      './cjs/api': {
        import: {
          types: './dist/cjs/api/index.d.mts',
          default: './dist/cjs/api/index.mjs',
        },
        require: {
          types: './dist/cjs/api/index.d.cts',
          default: './dist/cjs/api/index.cjs',
        },
      },
      './esm/api1': {
        import: {
          types: './dist/cjs/api/index.d.mts',
          default: './dist/cjs/api/index.mjs',
        },
        require: {
          types: './dist/cjs/api/index.d.cts',
          default: './dist/cjs/api/index.cjs',
        },
      },
      './esm': './dist/esm/index.mjs',
      './esm/api': {
        import: {
          types: './dist/esm/api/index.d.mts',
          default: './dist/esm/api/index.mjs',
        },
        require: {
          types: './dist/esm/api/index.d.cts',
          default: './dist/esm/api/index.cjs',
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
      'cjs': 'src/cjs.ts',
      'cjs/api': 'src/cjs/api.mts',
      'esm': 'src/esm/index.ts',
      'esm/api': 'src/esm/api/index.mts',
      'esm/api1': 'src/esm/api1/index.cts',
      'index': 'src/index.ts',
    });
  });

  it('should fail when exports is not exist', () => {
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

  it('should fail when entry point is not exist', () => {
    vi.mocked(existsSync).mockImplementation(() => false);
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
});

describe('getOutputParams', () => {
  const fixturePkgJson = {
    name: 'test-pkg',
    version: '0.0.0',
    readme: 'readme.md',
    _id: '',
    main: './path/to/cjs/index.js',
    module: './path/to/index.js',
    types: './path/to/types/index.d.js',
  };

  it('should get necessary parameters', () => {
    expect(
      getOutputParams({
        packageJson: fixturePkgJson,
        path: '/path/to/package.json',
      }),
    ).toStrictEqual({
      name: 'test-pkg',
      cjsDir: './path/to/cjs',
      esmDir: './path/to',
    });
  });

  it.each(['name', 'main', 'module'] as const)(
    'should throw error when not exist field at package.json: %s',
    (fieldName) => {
      const testPackageJson = Object.assign({}, fixturePkgJson);

      delete testPackageJson[fieldName];

      expect(() =>
        getOutputParams({
          packageJson: testPackageJson,
          path: '/path/to/package.json',
        }),
      ).toThrowError(`"${fieldName}" field which is required is not set:`);
    },
  );
});

describe('resolveCompilerOptions', () => {
  it('should compilerOptions to be resolved', () => {
    const defaultOptions = {
      outDir: './dist',
      declaration: true,
      declarationMap: true,
    };
    const inputtedOptions = {
      target: 'ESNext',
    };
    expect(resolveCompilerOptions(defaultOptions, inputtedOptions)).toStrictEqual({
      outDir: './dist',
      declaration: true,
      declarationMap: true,
      target: 'ESNext',
    });
  });
});

describe('getConfigPrams', () => {
  it('should return input and output parameters', () => {
    vi.mocked(existsSync).mockImplementation(() => {
      return true;
    });
    const fixturePkgPath = getFixturePackagePath('esm', 'build-success-esm');
    const fixture = {
      rootDir: dirname(fixturePkgPath),
      srcDir: 'src',
      rollupOptions: {},
      compilerOptions: {},
      externalOptions: {},
    };

    const { inputConfig, outputParams } = getConfigPrams(fixture);
    expect(inputConfig).toStrictEqual({
      index: 'src/index.ts',
    });
    expect(outputParams).toStrictEqual({
      name: 'fixture-build-success-esm',
      cjsDir: './dist/cjs',
      esmDir: './dist/es',
    });
  });
});

describe('resolveConfig', () => {
  it('should return default options', () => {
    expect(resolveConfig({})).toStrictEqual({
      rootDir: process.cwd(),
      srcDir: 'src',
      rollupOptions: {},
      compilerOptions: {},
      externalOptions: {},
    });
  });

  it('should return inputted options', () => {
    const fixture = {
      rootDir: '/path/to/custom',
      srcDir: 'lib',
      rollupOptions: {
        logLevel: 'debug',
      },
      compilerOptions: {
        module: 'ESNext',
      },
      externalOptions: {
        exclude: 'test',
      },
    } as const;
    expect(resolveConfig(fixture)).toStrictEqual(fixture);
  });
});
