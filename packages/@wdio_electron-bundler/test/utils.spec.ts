import { getInputConfig, getOutputParams, resolveConfig } from '../src/utils';
import { getFixturePackagePath } from './utils';

describe(`getInputConfig`, () => {
  it('should resolved entry point', () => {
    const pkgJsonPath = getFixturePackagePath('esm', 'build-test-esm');
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
      'index': 'src/index.ts',
      'mod1': 'src/mod1.ts',
      'mod2': 'src/mod2/index.ts',
      'mod3': 'src/mod3.mts',
      'mod4': 'src/mod4/index.mts',
      'mod5/api': 'src/mod5/api.cts',
      'mod6/api': 'src/mod6/api/index.cts',
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
    // vi.mocked(existsSync).mockImplementation(() => false);
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

describe('resolveConfig', () => {
  it('should return default options', () => {
    expect(resolveConfig({})).toStrictEqual({
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
