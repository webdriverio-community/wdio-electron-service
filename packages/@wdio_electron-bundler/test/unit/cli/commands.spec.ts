import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCommand } from '../../../src/cli/commands.js';
import { RollupExecutor } from '../../../src/cli/executor.js';
import { ConfigGenerator } from '../../../src/cli/generator.js';
import { ConfigLoader } from '../../../src/cli/loader.js';
import { Logger } from '../../../src/cli/logger.js';
import type { BuildOptions } from '../../../src/cli/types.js';

// Mock all dependencies
vi.mock('../../../src/cli/logger.js');
vi.mock('../../../src/cli/loader.js');
vi.mock('../../../src/cli/generator.js');
vi.mock('../../../src/cli/executor.js');

describe('buildCommand', () => {
  let mockLogger: any;
  let mockLoader: any;
  let mockGenerator: any;
  let mockExecutor: any;
  let processExitSpy: any;

  beforeEach(() => {
    // Mock Logger
    mockLogger = {
      info: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    };
    vi.mocked(Logger.create).mockReturnValue(mockLogger);

    // Mock ConfigLoader
    mockLoader = {
      loadConfig: vi.fn().mockResolvedValue({
        packageRoot: '/test/package',
        esm: {},
        cjs: {},
      }),
    };
    vi.mocked(ConfigLoader).mockImplementation(() => mockLoader);

    // Mock ConfigGenerator
    mockGenerator = {
      generateConfig: vi.fn().mockResolvedValue({
        configs: [],
        imports: [],
        packageInfo: {},
      }),
      writeConfig: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(ConfigGenerator).mockImplementation(() => mockGenerator);

    // Mock RollupExecutor
    mockExecutor = {
      executeBuild: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(RollupExecutor).mockImplementation(() => mockExecutor);

    // Mock process.exit
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  describe('successful builds', () => {
    it('should execute normal build successfully', async () => {
      const options: BuildOptions = {
        cwd: '/test',
        verbose: false,
        extraVerbose: false,
      };

      await buildCommand(options);

      expect(Logger.create).toHaveBeenCalledWith(false, false);
      expect(mockLogger.info).toHaveBeenCalledWith('🔨 Building project...');
      expect(mockLoader.loadConfig).toHaveBeenCalled();
      expect(mockGenerator.generateConfig).toHaveBeenCalledWith(
        { packageRoot: '/test/package', esm: {}, cjs: {} },
        '/test/package',
      );
      expect(mockExecutor.executeBuild).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith('Build completed successfully!');
    });

    it('should handle verbose build', async () => {
      const options: BuildOptions = {
        cwd: '/test',
        verbose: true,
        extraVerbose: false,
      };

      await buildCommand(options);

      expect(Logger.create).toHaveBeenCalledWith(true, false);
      expect(mockExecutor.executeBuild).toHaveBeenCalledWith(expect.any(Object), '/test/package', true);
    });

    it('should handle extra verbose build', async () => {
      const options: BuildOptions = {
        cwd: '/test',
        verbose: false,
        extraVerbose: true,
      };

      await buildCommand(options);

      expect(Logger.create).toHaveBeenCalledWith(false, true);
    });

    it('should use process.cwd() when packageRoot is not set', async () => {
      mockLoader.loadConfig.mockResolvedValue({
        esm: {},
        cjs: {},
      });

      const options: BuildOptions = {
        cwd: '/test',
      };

      await buildCommand(options);

      expect(mockGenerator.generateConfig).toHaveBeenCalledWith({ esm: {}, cjs: {} }, process.cwd());
    });
  });

  describe('dry run mode', () => {
    it('should handle dry run without export', async () => {
      const options: BuildOptions = {
        cwd: '/test',
        dryRun: true,
      };

      await buildCommand(options);

      expect(mockLogger.info).toHaveBeenCalledWith('🔍 Dry run: Generating configuration preview...');
      expect(mockGenerator.writeConfig).toHaveBeenCalledWith(expect.any(Object), 'rollup.config.js', true);
      expect(mockExecutor.executeBuild).not.toHaveBeenCalled();
      expect(mockLogger.success).not.toHaveBeenCalledWith('Build completed successfully!');
    });

    it('should handle dry run with export config', async () => {
      const options: BuildOptions = {
        cwd: '/test',
        dryRun: true,
        exportConfig: 'custom.config.js',
      };

      await buildCommand(options);

      expect(mockGenerator.writeConfig).toHaveBeenCalledTimes(2);
      // First call for export
      expect(mockGenerator.writeConfig).toHaveBeenNthCalledWith(
        1,
        expect.any(Object),
        expect.stringContaining('custom.config.js'),
        false,
      );
      // Second call for dry run preview
      expect(mockGenerator.writeConfig).toHaveBeenNthCalledWith(2, expect.any(Object), 'rollup.config.js', true);
      expect(mockLogger.success).toHaveBeenCalledWith(expect.stringContaining('custom.config.js'));
    });
  });

  describe('config export', () => {
    it('should export config with default filename', async () => {
      const options: BuildOptions = {
        cwd: '/test',
        exportConfig: true,
      };

      await buildCommand(options);

      expect(mockGenerator.writeConfig).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('rollup.config.js'),
        false,
      );
      expect(mockLogger.success).toHaveBeenCalledWith(expect.stringContaining('rollup.config.js'));
    });

    it('should export config with custom filename', async () => {
      const options: BuildOptions = {
        cwd: '/test',
        exportConfig: 'my-rollup.config.js',
      };

      await buildCommand(options);

      expect(mockGenerator.writeConfig).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('my-rollup.config.js'),
        false,
      );
      expect(mockLogger.success).toHaveBeenCalledWith(expect.stringContaining('my-rollup.config.js'));
    });
  });

  describe('error handling', () => {
    it('should handle config loading error', async () => {
      const error = new Error('Config loading failed');
      mockLoader.loadConfig.mockRejectedValue(error);

      const options: BuildOptions = {
        cwd: '/test',
      };

      await expect(async () => {
        await buildCommand(options);
      }).rejects.toThrow('process.exit called');

      expect(mockLogger.error).toHaveBeenCalledWith('Build failed: Config loading failed');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle config generation error', async () => {
      const error = new Error('Config generation failed');
      mockGenerator.generateConfig.mockRejectedValue(error);

      const options: BuildOptions = {
        cwd: '/test',
      };

      await expect(async () => {
        await buildCommand(options);
      }).rejects.toThrow('process.exit called');

      expect(mockLogger.error).toHaveBeenCalledWith('Build failed: Config generation failed');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle build execution error', async () => {
      const error = new Error('Build execution failed');
      mockExecutor.executeBuild.mockRejectedValue(error);

      const options: BuildOptions = {
        cwd: '/test',
      };

      await expect(async () => {
        await buildCommand(options);
      }).rejects.toThrow('process.exit called');

      expect(mockLogger.error).toHaveBeenCalledWith('Build failed: Build execution failed');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle config export error', async () => {
      const error = new Error('Config export failed');
      mockGenerator.writeConfig.mockRejectedValue(error);

      const options: BuildOptions = {
        cwd: '/test',
        exportConfig: true,
      };

      await expect(async () => {
        await buildCommand(options);
      }).rejects.toThrow('process.exit called');

      expect(mockLogger.error).toHaveBeenCalledWith('Build failed: Config export failed');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
