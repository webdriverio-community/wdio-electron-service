import { normalize } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigGenerator } from '../../../src/cli/generator.js';
import { Logger } from '../../../src/cli/logger.js';
import type { BundlerConfig } from '../../../src/cli/types.js';

// Mock fs modules and PackageAnalyzer
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

describe('ConfigGenerator', () => {
  let generator: ConfigGenerator;
  let logger: Logger;
  let mockExistsSync: any;
  let mockReadFile: any;

  beforeEach(async () => {
    logger = new Logger('normal');
    generator = new ConfigGenerator(logger);

    // Get mocked functions
    const fs = await import('node:fs');
    const fsPromises = await import('node:fs/promises');
    mockExistsSync = fs.existsSync;
    mockReadFile = fsPromises.readFile;

    // Reset mocks
    vi.clearAllMocks();

    // Setup basic mocks for package analysis
    // Use normalize to handle cross-platform path separators
    mockExistsSync.mockImplementation((path: string) => {
      const normalizedPath = normalize(path);
      if (normalizedPath.endsWith('package.json')) return true;
      if (normalizedPath.endsWith(normalize('src/index.ts'))) return true;
      return false;
    });

    const mockPackageJson = {
      name: '@test/package',
      version: '1.0.0',
      type: 'module',
      main: './dist/cjs/index.js',
      module: './dist/esm/index.js',
      exports: {
        '.': {
          import: './dist/esm/index.js',
          require: './dist/cjs/index.js',
        },
      },
      dependencies: { dep1: '^1.0.0' },
      devDependencies: { 'dev-dep1': '^2.0.0' },
      peerDependencies: {},
    };

    mockReadFile.mockResolvedValue(JSON.stringify(mockPackageJson));
  });

  describe('generateConfig', () => {
    it('should generate basic config for ESM and CJS', async () => {
      const bundlerConfig: BundlerConfig = {
        esm: {},
        cjs: {},
      };

      const result = await generator.generateConfig(bundlerConfig, '/test/package');

      expect(result.configs).toHaveLength(2);
      expect(result.configs[0].format).toBe('esm');
      expect(result.configs[1].format).toBe('cjs');
      expect(result.packageInfo.name).toBe('@test/package');
    });

    it('should generate config with only ESM when CJS is disabled', async () => {
      const bundlerConfig: BundlerConfig = {
        esm: {},
        cjs: false,
      };

      const result = await generator.generateConfig(bundlerConfig, '/test/package');

      expect(result.configs).toHaveLength(1);
      expect(result.configs[0].format).toBe('esm');
    });

    it('should include transformations in plugin specs', async () => {
      const bundlerConfig: BundlerConfig = {
        esm: {},
        cjs: {},
        transformations: [{ type: 'injectDependency', options: { from: 'dep1', imports: ['func1'] } }],
      };

      const result = await generator.generateConfig(bundlerConfig, '/test/package');

      const esmConfig = result.configs.find((c) => c.format === 'esm');
      expect(esmConfig?.plugins.some((p) => p.name === 'inject-dependency')).toBe(true);
    });

    it('should collect all imports from plugin specs', async () => {
      const bundlerConfig: BundlerConfig = {
        esm: {},
        cjs: {},
      };

      const result = await generator.generateConfig(bundlerConfig, '/test/package');

      expect(result.imports.length).toBeGreaterThan(0);
      expect(result.imports.some((imp) => imp.from === '@rollup/plugin-typescript')).toBe(true);
    });

    it('should handle custom bundle/external configuration', async () => {
      const bundlerConfig: BundlerConfig = {
        esm: {
          bundle: ['custom-dep'],
          external: ['^react$'],
        },
        cjs: {},
      };

      const result = await generator.generateConfig(bundlerConfig, '/test/package');

      const esmConfig = result.configs.find((c) => c.format === 'esm');
      const nodeExternalsPlugin = esmConfig?.plugins.find((p) => p.name === 'node-externals');
      expect(nodeExternalsPlugin).toBeDefined();
      // Not asserting plugin internals to avoid binding tests to specific rollup plugin API
      expect(nodeExternalsPlugin?.call).toContain('nodeExternals(');
    });
  });

  describe('writeConfig', () => {
    const mockGeneratedConfig = {
      imports: [{ from: '@rollup/plugin-typescript', default: 'typescript' }],
      configs: [
        {
          input: { index: 'src/index.ts' },
          output: {
            format: 'esm' as const,
            dir: 'dist/esm',
            sourcemap: true,
            plugins: [],
          },
          plugins: [
            {
              name: 'typescript',
              call: 'typescript()',
              import: { from: '@rollup/plugin-typescript', default: 'typescript' },
            },
          ],
          format: 'esm' as const,
        },
      ],
      packageInfo: {
        name: '@test/package',
        version: '1.0.0',
        type: 'module' as const,
        input: { index: 'src/index.ts' },
        outDir: { esm: 'dist/esm', cjs: 'dist/cjs' },
        dependencies: [],
        devDependencies: [],
        peerDependencies: [],
      },
    };

    it('should write config to file', async () => {
      const fsPromises = await import('node:fs/promises');
      const mockWriteFile = fsPromises.writeFile as any;
      const mockMkdir = fsPromises.mkdir as any;

      mockWriteFile.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);

      const result = await generator.writeConfig(mockGeneratedConfig, 'rollup.config.js', false);

      expect(mockMkdir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalledWith(
        'rollup.config.js',
        expect.stringContaining('export default'),
        'utf-8',
      );
      expect(result).toContain('export default');
    });

    it('should return config content in dry run mode', async () => {
      const result = await generator.writeConfig(mockGeneratedConfig, 'rollup.config.js', true);

      expect(result).toContain("import typescript from '@rollup/plugin-typescript'");
      expect(result).toContain('export default');
    });

    it('should handle multiple configurations with proper naming', async () => {
      const multiConfig = {
        ...mockGeneratedConfig,
        configs: [
          {
            ...mockGeneratedConfig.configs[0],
            format: 'esm' as const,
          },
          {
            ...mockGeneratedConfig.configs[0],
            format: 'cjs' as const,
            output: {
              ...mockGeneratedConfig.configs[0].output,
              format: 'cjs' as const,
              dir: 'dist/cjs',
            },
          },
        ],
      };

      const result = await generator.writeConfig(multiConfig, 'rollup.config.js', true);

      expect(result).toContain('const esmConfig');
      expect(result).toContain('const cjsConfig');
      expect(result).toContain('export default [esmConfig, cjsConfig]');
    });

    it('should handle complex input configuration', async () => {
      const complexConfig = {
        ...mockGeneratedConfig,
        configs: [
          {
            ...mockGeneratedConfig.configs[0],
            input: {
              main: 'src/index.ts',
              worker: 'src/worker.ts',
              utils: 'src/utils.ts',
            },
          },
        ],
      };

      const result = await generator.writeConfig(complexConfig, 'rollup.config.js', true);

      expect(result).toContain("main: 'src/index.ts'");
      expect(result).toContain("worker: 'src/worker.ts'");
      expect(result).toContain("utils: 'src/utils.ts'");
    });

    it('should handle CJS output configuration with exports and dynamicImportInCjs', async () => {
      const cjsConfig = {
        ...mockGeneratedConfig,
        configs: [
          {
            ...mockGeneratedConfig.configs[0],
            format: 'cjs' as const,
            output: {
              format: 'cjs' as const,
              dir: 'dist/cjs',
              sourcemap: true,
              plugins: [],
            },
          },
        ],
      };

      const result = await generator.writeConfig(cjsConfig, 'rollup.config.js', true);

      expect(result).toContain("exports: 'named'");
      expect(result).toContain('dynamicImportInCjs: false');
    });

    it('should handle output plugins', async () => {
      const configWithOutputPlugins = {
        ...mockGeneratedConfig,
        configs: [
          {
            ...mockGeneratedConfig.configs[0],
            output: {
              ...mockGeneratedConfig.configs[0].output,
              plugins: [
                {
                  name: 'emit-package-json',
                  code: `{
        name: 'emit-package-json',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'package.json',
            source: '{ "type": "module" }',
          });
        },
      }`,
                },
              ],
            },
          },
        ],
      };

      const result = await generator.writeConfig(configWithOutputPlugins, 'rollup.config.js', true);

      expect(result).toContain('plugins: [');
      expect(result).toContain('emit-package-json');
      expect(result).toContain('generateBundle()');
    });

    it('should handle inline plugins correctly', async () => {
      const configWithInlinePlugins = {
        ...mockGeneratedConfig,
        configs: [
          {
            ...mockGeneratedConfig.configs[0],
            plugins: [
              {
                name: 'typescript',
                call: 'typescript()',
                import: { from: '@rollup/plugin-typescript', default: 'typescript' },
                inline: false,
              },
              {
                name: 'warn-to-error',
                call: `{
      name: 'warn-to-error',
      onLog(level, log) {
        if (level === 'warn') {
          this.error(log);
        }
      },
    }`,
                import: { from: '', default: '' }, // Inline plugins still need import field, even if empty
                inline: true,
              },
            ],
          },
        ],
      };

      const result = await generator.writeConfig(configWithInlinePlugins, 'rollup.config.js', true);

      expect(result).toContain('typescript()');
      expect(result).toContain('warn-to-error');
      expect(result).toContain('onLog(level, log)');
    });

    it('should filter out empty imports', async () => {
      const configWithEmptyImports = {
        ...mockGeneratedConfig,
        imports: [
          { from: '@rollup/plugin-typescript', default: 'typescript' },
          { from: '', default: 'empty' }, // Should be filtered out
          { from: 'rollup-plugin-node-externals', named: ['nodeExternals'] },
        ],
      };

      const result = await generator.writeConfig(configWithEmptyImports, 'rollup.config.js', true);

      expect(result).toContain("import typescript from '@rollup/plugin-typescript'");
      expect(result).toContain("import { nodeExternals } from 'rollup-plugin-node-externals'");
      expect(result).not.toContain('import empty');
    });

    it('should handle mixed default and named imports', async () => {
      const configWithMixedImports = {
        ...mockGeneratedConfig,
        imports: [
          {
            from: '@rollup/plugin-typescript',
            default: 'typescript',
            named: ['createProgram'],
          },
        ],
      };

      const result = await generator.writeConfig(configWithMixedImports, 'rollup.config.js', true);

      expect(result).toContain("import typescript, { createProgram } from '@rollup/plugin-typescript'");
    });

    it('should generate ESM syntax for module type packages', async () => {
      const esmPackageConfig = {
        ...mockGeneratedConfig,
        packageInfo: {
          ...mockGeneratedConfig.packageInfo,
          type: 'module' as const,
        },
      };

      const result = await generator.writeConfig(esmPackageConfig, 'rollup.config.js', true);

      expect(result).toContain("import typescript from '@rollup/plugin-typescript'");
      expect(result).toContain('export default');
      expect(result).not.toContain('const typescript = require');
      expect(result).not.toContain('module.exports');
    });

    it('should generate CommonJS syntax for commonjs type packages', async () => {
      const cjsPackageConfig = {
        ...mockGeneratedConfig,
        packageInfo: {
          ...mockGeneratedConfig.packageInfo,
          type: 'commonjs' as const,
        },
      };

      const result = await generator.writeConfig(cjsPackageConfig, 'rollup.config.js', true);

      expect(result).toContain("const typescript = require('@rollup/plugin-typescript');");
      expect(result).toContain('module.exports =');
      expect(result).not.toContain('import typescript from');
      expect(result).not.toContain('export default');
    });

    it('should handle mixed default and named imports in CommonJS', async () => {
      const cjsConfigWithMixedImports = {
        ...mockGeneratedConfig,
        imports: [
          {
            from: '@rollup/plugin-node-resolve',
            default: 'nodeResolve',
            named: ['createFilter'],
          },
        ],
        packageInfo: {
          ...mockGeneratedConfig.packageInfo,
          type: 'commonjs' as const,
        },
      };

      const result = await generator.writeConfig(cjsConfigWithMixedImports, 'rollup.config.js', true);

      expect(result).toContain("const nodeResolve = require('@rollup/plugin-node-resolve');");
      expect(result).toContain('const { createFilter } = nodeResolve;');
      expect(result).toContain('module.exports =');
    });

    it('should handle named-only imports in CommonJS', async () => {
      const cjsConfigWithNamedImports = {
        ...mockGeneratedConfig,
        imports: [
          {
            from: 'rollup-plugin-node-externals',
            named: ['nodeExternals'],
          },
        ],
        packageInfo: {
          ...mockGeneratedConfig.packageInfo,
          type: 'commonjs' as const,
        },
      };

      const result = await generator.writeConfig(cjsConfigWithNamedImports, 'rollup.config.js', true);

      expect(result).toContain("const { nodeExternals } = require('rollup-plugin-node-externals');");
      expect(result).toContain('module.exports =');
    });

    it('should handle multiple configs with CommonJS syntax', async () => {
      const cjsMultiConfig = {
        ...mockGeneratedConfig,
        configs: [
          {
            ...mockGeneratedConfig.configs[0],
            format: 'esm' as const,
          },
          {
            ...mockGeneratedConfig.configs[0],
            format: 'cjs' as const,
            output: {
              ...mockGeneratedConfig.configs[0].output,
              format: 'cjs' as const,
              dir: 'dist/cjs',
            },
          },
        ],
        packageInfo: {
          ...mockGeneratedConfig.packageInfo,
          type: 'commonjs' as const,
        },
      };

      const result = await generator.writeConfig(cjsMultiConfig, 'rollup.config.js', true);

      expect(result).toContain('const esmConfig');
      expect(result).toContain('const cjsConfig');
      expect(result).toContain('module.exports = [esmConfig, cjsConfig]');
      expect(result).not.toContain('export default');
    });
  });
});
