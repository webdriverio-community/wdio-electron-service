import { normalize } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RollupExecutor } from '../../../src/cli/executor.js';
import { Logger } from '../../../src/cli/logger.js';

// Mock rollup
vi.mock('rollup', () => ({
  rollup: vi.fn(),
}));

// Mock dynamic imports
vi.mock('@rollup/plugin-typescript', () => ({
  default: vi.fn(() => ({ name: 'typescript' })),
}));

vi.mock('rollup-plugin-node-externals', () => ({
  nodeExternals: vi.fn(() => ({ name: 'node-externals' })),
}));

vi.mock('@rollup/plugin-node-resolve', () => ({
  nodeResolve: vi.fn(() => ({ name: 'node-resolve' })),
}));

vi.mock('typescript', () => ({
  default: { version: '5.0.0' },
}));

describe('RollupExecutor', () => {
  let executor: RollupExecutor;
  let logger: Logger;
  let mockBundle: any;
  let mockRollup: any;

  beforeEach(async () => {
    logger = new Logger('normal');
    executor = new RollupExecutor(logger);

    // Mock bundle object
    mockBundle = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    // Mock rollup function
    const { rollup } = await import('rollup');
    mockRollup = vi.mocked(rollup);
    mockRollup.mockClear(); // Clear any previous calls
    mockRollup.mockResolvedValue(mockBundle);

    // Clear other mocks
    vi.clearAllMocks();

    // Spy on logger methods
    vi.spyOn(logger, 'section');
    vi.spyOn(logger, 'detail');
    vi.spyOn(logger, 'extraDetail');
  });

  describe('executeBuild', () => {
    it('should successfully execute build for single configuration', async () => {
      const mockConfig = {
        configs: [
          {
            format: 'esm',
            input: { index: 'src/index.ts' },
            output: {
              format: 'esm',
              dir: 'dist/esm',
              sourcemap: true,
            },
            plugins: [{ name: 'typescript' }, { name: 'node-externals' }],
          },
        ],
      };

      await executor.executeBuild(mockConfig as any, '/test/package', false);

      expect(logger.section).toHaveBeenCalledWith('🔨 Executing rollup build...');
      expect(logger.extraDetail).toHaveBeenCalledWith('Target directory: /test/package');
      expect(logger.extraDetail).toHaveBeenCalledWith('Configurations: 1');
      expect(logger.detail).toHaveBeenCalledWith('📦 Building ESM bundle...');
      expect(logger.detail).toHaveBeenCalledWith('✅ Build completed successfully');

      expect(mockRollup).toHaveBeenCalledTimes(1);
      expect(mockBundle.write).toHaveBeenCalledTimes(1);
      expect(mockBundle.close).toHaveBeenCalledTimes(1);
    });

    it('should handle verbose mode with extra logging', async () => {
      const mockConfig = {
        configs: [
          {
            format: 'esm',
            input: { index: 'src/index.ts' },
            output: {
              format: 'esm',
              dir: 'dist/esm',
              sourcemap: true,
            },
            plugins: [{ name: 'typescript' }],
          },
        ],
      };

      await executor.executeBuild(mockConfig as any, '/test/package', true);

      expect(logger.extraDetail).toHaveBeenCalledWith(expect.stringContaining('Input:'));
      expect(logger.extraDetail).toHaveBeenCalledWith(expect.stringContaining('Output dir:'));
      expect(logger.extraDetail).toHaveBeenCalledWith('✅ ESM bundle written');
    });

    it('should close bundle even if write fails', async () => {
      const mockConfig = {
        configs: [
          {
            format: 'esm',
            input: { index: 'src/index.ts' },
            output: {
              format: 'esm',
              dir: 'dist/esm',
              sourcemap: true,
            },
            plugins: [{ name: 'typescript' }],
          },
        ],
      };

      mockBundle.write.mockRejectedValue(new Error('Write failed'));

      await expect(executor.executeBuild(mockConfig as any, '/test/package', false)).rejects.toThrow(
        'Rollup build failed: Write failed',
      );

      expect(mockBundle.close).toHaveBeenCalledTimes(1);
    });

    it('should handle rollup creation failure', async () => {
      const mockConfig = {
        configs: [
          {
            format: 'esm',
            input: { index: 'src/index.ts' },
            output: {
              format: 'esm',
              dir: 'dist/esm',
              sourcemap: true,
            },
            plugins: [{ name: 'typescript' }],
          },
        ],
      };

      mockRollup.mockRejectedValue(new Error('Rollup creation failed'));

      await expect(executor.executeBuild(mockConfig as any, '/test/package', false)).rejects.toThrow(
        'Rollup build failed: Rollup creation failed',
      );
    });

    it('should handle multiple configurations', async () => {
      const mockConfig = {
        configs: [
          {
            format: 'esm',
            input: { index: 'src/index.ts' },
            output: { format: 'esm', dir: 'dist/esm', sourcemap: true },
            plugins: [{ name: 'typescript' }],
          },
          {
            format: 'cjs',
            input: { index: 'src/index.ts' },
            output: { format: 'cjs', dir: 'dist/cjs', sourcemap: true },
            plugins: [{ name: 'typescript' }],
          },
        ],
      };

      await executor.executeBuild(mockConfig as any, '/test/package', false);

      expect(logger.detail).toHaveBeenCalledWith('📦 Building ESM bundle...');
      expect(logger.detail).toHaveBeenCalledWith('📦 Building CJS bundle...');
      expect(mockRollup).toHaveBeenCalledTimes(2);
      expect(mockBundle.write).toHaveBeenCalledTimes(2);
      expect(mockBundle.close).toHaveBeenCalledTimes(2);
    });

    it('should handle string input configuration', async () => {
      const mockConfig = {
        configs: [
          {
            format: 'esm',
            input: 'src/index.ts', // String input instead of object
            output: { format: 'esm', dir: 'dist/esm', sourcemap: true },
            plugins: [{ name: 'typescript' }],
          },
        ],
      };

      await executor.executeBuild(mockConfig as any, '/test/package', false);

      expect(mockRollup).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.stringContaining(normalize('src/index.ts')), // Should be resolved as string
        }),
      );
    });

    it('should handle all plugin types', async () => {
      const mockConfig = {
        configs: [
          {
            format: 'esm',
            input: { index: 'src/index.ts' },
            output: {
              format: 'esm',
              dir: 'dist/esm',
              sourcemap: true,
              plugins: [{ name: 'emit-package-json' }],
            },
            plugins: [
              { name: 'typescript' },
              { name: 'node-externals', options: { deps: true } },
              { name: 'node-resolve' },
              { name: 'warn-to-error' },
            ],
          },
        ],
      };

      await executor.executeBuild(mockConfig as any, '/test/package', false);

      expect(mockRollup).toHaveBeenCalledWith(
        expect.objectContaining({
          plugins: expect.arrayContaining([
            expect.objectContaining({ name: 'typescript' }),
            expect.objectContaining({ name: 'node-externals' }),
            expect.objectContaining({ name: 'node-resolve' }),
            expect.objectContaining({ name: 'warn-to-error' }),
          ]),
        }),
      );
    });

    it('should handle CJS output configuration', async () => {
      const mockConfig = {
        configs: [
          {
            format: 'cjs',
            input: { index: 'src/index.ts' },
            output: {
              format: 'cjs',
              dir: 'dist/cjs',
              sourcemap: true,
              dynamicImportInCjs: false,
              plugins: [{ name: 'emit-package-json' }],
            },
            plugins: [{ name: 'typescript' }],
          },
        ],
      };

      await executor.executeBuild(mockConfig as any, '/test/package', false);

      expect(mockRollup).toHaveBeenCalledWith(
        expect.objectContaining({
          output: expect.objectContaining({
            format: 'cjs',
            exports: 'named',
            dynamicImportInCjs: false,
            plugins: expect.arrayContaining([
              expect.objectContaining({
                name: 'emit-package-json',
              }),
            ]),
          }),
        }),
      );
    });

    it('should handle output plugins with different names', async () => {
      const mockConfig = {
        configs: [
          {
            format: 'esm',
            input: { index: 'src/index.ts' },
            output: {
              format: 'esm',
              dir: 'dist/esm',
              sourcemap: true,
              plugins: [{ name: 'custom-plugin' }],
            },
            plugins: [{ name: 'typescript' }],
          },
        ],
      };

      await executor.executeBuild(mockConfig as any, '/test/package', false);

      const rollupCall = mockRollup.mock.calls[0][0];
      const outputPlugins = (rollupCall.output as any).plugins;
      expect(outputPlugins[0].name).toBe('custom-plugin');

      // Test the generateBundle function for non-emit-package-json plugins
      const mockThis = {
        emitFile: vi.fn(),
      };
      outputPlugins[0].generateBundle.call(mockThis);
      expect(mockThis.emitFile).toHaveBeenCalledWith({
        type: 'asset',
        fileName: 'package.json',
        source: '',
      });
    });
  });
});
