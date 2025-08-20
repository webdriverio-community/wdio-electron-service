import { normalize } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PackageAnalyzer } from '../../../src/cli/analyzer.js';
import { Logger } from '../../../src/cli/logger.js';
import type { BundlerConfig, PackageInfo } from '../../../src/cli/types.js';

// Mock fs modules
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('PackageAnalyzer', () => {
  let analyzer: PackageAnalyzer;
  let logger: Logger;
  let mockExistsSync: any;
  let mockReadFile: any;

  beforeEach(async () => {
    logger = new Logger('normal');
    analyzer = new PackageAnalyzer(logger);

    // Get mocked functions
    const fs = await import('node:fs');
    const fsPromises = await import('node:fs/promises');
    mockExistsSync = fs.existsSync;
    mockReadFile = fsPromises.readFile;

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('analyzePackage', () => {
    const mockPackageJson = {
      name: '@test/package',
      version: '1.0.0',
      main: './dist/cjs/index.js',
      module: './dist/esm/index.js',
      exports: {
        '.': {
          import: './dist/esm/index.js',
          require: './dist/cjs/index.js',
        },
      },
      dependencies: {
        dep1: '^1.0.0',
      },
      devDependencies: {
        'dev-dep1': '^2.0.0',
      },
      peerDependencies: {
        'peer-dep1': '^3.0.0',
      },
    };

    it('should analyze a basic package successfully', async () => {
      const packageRoot = '/test/package';

      mockExistsSync.mockImplementation((path: string) => {
        const normalizedPath = normalize(path);
        if (normalizedPath.endsWith('package.json')) return true;
        if (normalizedPath.endsWith(normalize('src/index.ts'))) return true;
        return false;
      });

      mockReadFile.mockResolvedValue(JSON.stringify(mockPackageJson));

      const result = await analyzer.analyzePackage(packageRoot);

      expect(result).toEqual({
        name: '@test/package',
        version: '1.0.0',
        type: 'commonjs',
        input: { index: 'src/index.ts' },
        outDir: { esm: './dist/esm', cjs: './dist/cjs' },
        dependencies: ['dep1'],
        devDependencies: ['dev-dep1'],
        peerDependencies: ['peer-dep1'],
      });
    });

    it('should throw error when package.json does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(analyzer.analyzePackage('/test/package')).rejects.toThrow('package.json not found at');
    });

    it('should throw error when package.json has no name', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(JSON.stringify({ version: '1.0.0' }));

      await expect(analyzer.analyzePackage('/test/package')).rejects.toThrow(
        'Package name is required in package.json',
      );
    });

    it('should throw error when package.json has no exports', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(JSON.stringify({ name: 'test' }));

      await expect(analyzer.analyzePackage('/test/package')).rejects.toThrow(
        'package.json must have an "exports" field',
      );
    });

    it('should handle multiple entry points', async () => {
      const multiExportPackage = {
        ...mockPackageJson,
        exports: {
          '.': { import: './dist/esm/index.js', require: './dist/cjs/index.js' },
          './utils': { import: './dist/esm/utils.js', require: './dist/cjs/utils.js' },
        },
      };

      mockExistsSync.mockImplementation((path: string) => {
        const normalizedPath = normalize(path);
        if (normalizedPath.endsWith('package.json')) return true;
        if (normalizedPath.endsWith(normalize('src/index.ts'))) return true;
        if (normalizedPath.endsWith(normalize('src/utils.ts'))) return true;
        return false;
      });

      mockReadFile.mockResolvedValue(JSON.stringify(multiExportPackage));

      const result = await analyzer.analyzePackage('/test/package');

      expect(result.input).toEqual({
        index: 'src/index.ts',
        utils: 'src/utils.ts',
      });
      expect(result.type).toBe('commonjs');
    });

    it('should handle different file extensions', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        const normalizedPath = normalize(path);
        if (normalizedPath.endsWith('package.json')) return true;
        if (normalizedPath.endsWith(normalize('src/index.mts'))) return true; // .mts instead of .ts
        return false;
      });

      mockReadFile.mockResolvedValue(JSON.stringify(mockPackageJson));

      const result = await analyzer.analyzePackage('/test/package');

      expect(result.input).toEqual({ index: 'src/index.mts' });
      expect(result.type).toBe('commonjs');
    });

    it('should handle index files in subdirectories', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        const normalizedPath = normalize(path);
        if (normalizedPath.endsWith('package.json')) return true;
        if (normalizedPath.endsWith(normalize('src/index/index.ts'))) return true;
        return false;
      });

      mockReadFile.mockResolvedValue(JSON.stringify(mockPackageJson));

      const result = await analyzer.analyzePackage('/test/package');

      expect(result.input).toEqual({ index: 'src/index/index.ts' });
      expect(result.type).toBe('commonjs');
    });

    it('should detect ESM package type when type is "module"', async () => {
      const esmPackageJson = {
        ...mockPackageJson,
        type: 'module',
      };

      mockExistsSync.mockImplementation((path: string) => {
        const normalizedPath = normalize(path);
        if (normalizedPath.endsWith('package.json')) return true;
        if (normalizedPath.endsWith(normalize('src/index.ts'))) return true;
        return false;
      });

      mockReadFile.mockResolvedValue(JSON.stringify(esmPackageJson));

      const result = await analyzer.analyzePackage('/test/package');

      expect(result.type).toBe('module');
      expect(result.name).toBe('@test/package');
    });

    it('should detect CJS package type when type is "commonjs"', async () => {
      const cjsPackageJson = {
        ...mockPackageJson,
        type: 'commonjs',
      };

      mockExistsSync.mockImplementation((path: string) => {
        const normalizedPath = normalize(path);
        if (normalizedPath.endsWith('package.json')) return true;
        if (normalizedPath.endsWith(normalize('src/index.ts'))) return true;
        return false;
      });

      mockReadFile.mockResolvedValue(JSON.stringify(cjsPackageJson));

      const result = await analyzer.analyzePackage('/test/package');

      expect(result.type).toBe('commonjs');
      expect(result.name).toBe('@test/package');
    });

    it('should default to commonjs when type field is missing', async () => {
      const packageJsonWithoutType = {
        name: '@test/package',
        version: '1.0.0',
        main: './dist/cjs/index.js',
        module: './dist/esm/index.js',
        exports: {
          '.': {
            import: './dist/esm/index.js',
            require: './dist/cjs/index.js',
          },
        },
      };

      mockExistsSync.mockImplementation((path: string) => {
        const normalizedPath = normalize(path);
        if (normalizedPath.endsWith('package.json')) return true;
        if (normalizedPath.endsWith(normalize('src/index.ts'))) return true;
        return false;
      });

      mockReadFile.mockResolvedValue(JSON.stringify(packageJsonWithoutType));

      const result = await analyzer.analyzePackage('/test/package');

      expect(result.type).toBe('commonjs');
      expect(result.name).toBe('@test/package');
    });
  });

  describe('buildPluginSpecs', () => {
    const mockConfig: BundlerConfig = {
      esm: { input: 'src/index.ts', output: { dir: 'dist/esm', format: 'es' } },
      cjs: { input: 'src/index.ts', output: { dir: 'dist/cjs', format: 'cjs' } },
    };

    const mockPackageInfo: PackageInfo = {
      name: '@test/package',
      version: '1.0.0',
      type: 'commonjs',
      input: { index: 'src/index.ts' },
      outDir: { esm: 'dist/esm', cjs: 'dist/cjs' },
      dependencies: ['dep1'],
      devDependencies: ['dev-dep1'],
      peerDependencies: [],
    };

    it('should build basic plugin specs', () => {
      const plugins = analyzer.buildPluginSpecs(mockConfig, mockPackageInfo, '/test/package', 'esm');

      expect(plugins).toHaveLength(3); // typescript, nodeExternals, warnToError
      expect(plugins[0].name).toBe('typescript');
      expect(plugins[1].name).toBe('node-externals');
      expect(plugins[2].name).toBe('warn-to-error');
    });

    it('should include nodeResolve when injectDependency transformation exists', () => {
      const configWithTransformations: BundlerConfig = {
        ...mockConfig,
        transformations: [{ type: 'injectDependency', options: { from: 'dep1', imports: ['func1'] } }],
      };

      const plugins = analyzer.buildPluginSpecs(configWithTransformations, mockPackageInfo, '/test/package', 'esm');

      expect(plugins).toHaveLength(5); // typescript, nodeExternals, nodeResolve, injectDependency, warnToError
      expect(plugins.some((p) => p.name === 'node-resolve')).toBe(true);
      expect(plugins.some((p) => p.name === 'inject-dependency')).toBe(true);
    });

    it('should include codeReplace transformation plugin', () => {
      const configWithTransformations: BundlerConfig = {
        ...mockConfig,
        transformations: [{ type: 'codeReplace', options: { from: 'old', to: 'new' } }],
      };

      const plugins = analyzer.buildPluginSpecs(configWithTransformations, mockPackageInfo, '/test/package', 'esm');

      expect(plugins.some((p) => p.name === 'code-replace')).toBe(true);
    });

    it('should handle nodeExternals options for different formats', () => {
      const esmPlugins = analyzer.buildPluginSpecs(mockConfig, mockPackageInfo, '/test/package', 'esm');
      const cjsPlugins = analyzer.buildPluginSpecs(mockConfig, mockPackageInfo, '/test/package', 'cjs');

      const esmNodeExternals = esmPlugins.find((p) => p.name === 'node-externals');
      const cjsNodeExternals = cjsPlugins.find((p) => p.name === 'node-externals');

      // Should exist in both formats
      expect(esmNodeExternals).toBeDefined();
      expect(cjsNodeExternals).toBeDefined();
    });
  });

  describe('collectImports', () => {
    it('should collect unique imports from plugin specs', () => {
      const plugins = [
        {
          name: 'plugin1',
          call: 'typescript()',
          import: { from: '@rollup/plugin-typescript', default: 'typescript' },
          inline: false,
        },
        {
          name: 'plugin2',
          call: 'nodeResolve()',
          import: { from: '@rollup/plugin-node-resolve', default: 'nodeResolve' },
          inline: false,
        },
        {
          name: 'plugin3',
          call: 'createFilter()',
          import: { from: '@rollup/plugin-typescript', named: ['createFilter'] },
          inline: false,
        },
      ];

      const imports = analyzer.collectImports(plugins);

      expect(imports).toHaveLength(2);
      expect(imports[0]).toEqual({
        from: '@rollup/plugin-typescript',
        default: 'typescript',
        named: ['createFilter'],
      });
      expect(imports[1]).toEqual({
        from: '@rollup/plugin-node-resolve',
        default: 'nodeResolve',
      });
    });

    it('should skip inline plugins', () => {
      const plugins = [
        {
          name: 'plugin1',
          call: 'typescript()',
          import: { from: '@rollup/plugin-typescript', default: 'typescript' },
          inline: true,
        },
        {
          name: 'plugin2',
          call: 'nodeResolve()',
          import: { from: '@rollup/plugin-node-resolve', default: 'nodeResolve' },
          inline: false,
        },
      ];

      const imports = analyzer.collectImports(plugins);

      expect(imports).toHaveLength(1);
      expect(imports[0].from).toBe('@rollup/plugin-node-resolve');
    });

    it('should handle plugins without imports', () => {
      const plugins = [
        {
          name: 'plugin1',
          call: 'somePlugin()',
          import: { from: '', default: '' },
          inline: false,
        },
      ];

      const imports = analyzer.collectImports(plugins);

      expect(imports).toHaveLength(0);
    });
  });

  describe('createEmitPackageJsonPlugin', () => {
    it('should create ESM package.json plugin', () => {
      const plugin = analyzer.createEmitPackageJsonPlugin('@test/package', 'esm');

      expect(plugin.name).toBe('emit-package-json');
      expect(plugin.code).toContain('"{ \\"type\\": \\"module\\" }"');
    });

    it('should create CJS package.json plugin', () => {
      const plugin = analyzer.createEmitPackageJsonPlugin('@test/package', 'cjs');

      expect(plugin.name).toBe('emit-package-json');
      expect(plugin.code).toContain('"{ \\"type\\": \\"commonjs\\" }"');
    });
  });
});
