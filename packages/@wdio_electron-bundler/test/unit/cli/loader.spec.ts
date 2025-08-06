import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigLoader } from '../../../src/cli/loader.js';
import { Logger } from '../../../src/cli/logger.js';

// Mock fs for tests
vi.mock('node:fs');
vi.mock('node:fs/promises');

// Mock node:fs synchronous functions
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

// Mock child_process with more sophisticated spawn mock
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

describe('ConfigLoader', () => {
  let loader: ConfigLoader;
  let logger: Logger;
  let mockWriteFileSync: any;
  let mockReadFileSync: any;
  let mockUnlinkSync: any;
  let mockSpawn: any;

  beforeEach(async () => {
    logger = Logger.create();
    loader = new ConfigLoader('/test/cwd', logger);
    vi.clearAllMocks();

    // Get the mocked functions
    const fs = await import('node:fs');
    const childProcess = await import('node:child_process');

    mockWriteFileSync = vi.mocked(fs.writeFileSync);
    mockReadFileSync = vi.mocked(fs.readFileSync);
    mockUnlinkSync = vi.mocked(fs.unlinkSync);
    mockSpawn = vi.mocked(childProcess.spawn);

    // Default mock for existsSync - tests can override this
    vi.mocked(existsSync).mockReturnValue(true);
  });

  describe('loadConfig', () => {
    it('should load config with defaults when no config file exists', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const config = await loader.loadConfig();

      expect(config).toBeDefined();
      expect(config.packageRoot).toBe('/test/cwd');
      expect(config.cjs).toBe(true);
      expect(config.transformations).toEqual([]);
    });

    it('should load config from JSON file when it exists', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        return pathStr.includes('wdio-bundler.config.json');
      });

      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({
          esm: {
            input: 'src/index.ts',
            output: { dir: 'dist/esm', format: 'es' },
          },
          cjs: {
            input: 'src/index.ts',
            output: { dir: 'dist/cjs', format: 'cjs' },
          },
        }),
      );

      const config = await loader.loadConfig();
      expect(config).toBeDefined();
      expect(config.esm).toBeDefined();
      expect(config.cjs).toBeDefined();
    });

    it('should load config from TypeScript file when it exists', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        return pathStr.includes('wdio-bundler.config.ts');
      });

      // Mock the spawn process to simulate successful tsx execution
      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stderr: { on: vi.fn() },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              callback(0); // Success
            }
          }),
        };
        return mockChild;
      });

      // Mock readFileSync to return serialized config
      const serializedConfig = {
        esm: { input: 'src/index.ts' },
        cjs: { input: 'src/index.ts' },
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(serializedConfig));

      const config = await loader.loadConfig();
      expect(config).toBeDefined();
      expect(config.esm).toBeDefined();
      expect(config.cjs).toBeDefined();

      // Verify temp files were created and cleaned up
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
      expect(mockUnlinkSync).toHaveBeenCalledTimes(2); // temp script and temp json
    });

    it('should handle complex TypeScript config with functions and regex', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        return pathStr.includes('wdio-bundler.config.ts');
      });

      // Mock successful tsx execution
      mockSpawn.mockImplementation(() => ({
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      }));

      // Mock complex serialized config with functions and regex
      const serializedConfig = {
        transformations: [
          {
            type: 'injectDependency',
            options: {
              targetFile: 'test.js',
              dependencies: ['@vitest/spy'],
              pattern: {
                __type: 'regexp',
                __value: '/import.*@vitest\\/spy/g',
              },
              replacement: {
                __type: 'function',
                __value: 'function() { return "replaced"; }',
              },
            },
          },
        ],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(serializedConfig));

      const config = await loader.loadConfig();

      expect(config.transformations).toHaveLength(1);
      expect(config.transformations[0].type).toBe('injectDependency');
      expect(config.transformations[0].options.pattern).toBeInstanceOf(RegExp);
      expect(config.transformations[0].options.replacement).toBeInstanceOf(Function);
      expect(config.transformations[0].options.replacement()).toBe('replaced');
    });

    it('should handle invalid regex in TypeScript config', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        return pathStr.includes('wdio-bundler.config.ts');
      });

      mockSpawn.mockImplementation(() => ({
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      }));

      // Mock config with invalid regex format
      const serializedConfig = {
        transformations: [
          {
            type: 'codeReplace',
            options: {
              pattern: {
                __type: 'regexp',
                __value: 'invalid-regex-format',
              },
            },
          },
        ],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(serializedConfig));

      const config = await loader.loadConfig();

      // Should fallback to creating regex from the raw string
      expect(config.transformations[0].options.pattern).toBeInstanceOf(RegExp);
    });

    it('should validate loaded config', () => {
      const validConfig = {
        packageRoot: '/test/cwd',
        esm: {
          input: 'src/index.ts',
          output: { dir: 'dist/esm', format: 'es' as const },
        },
        cjs: {
          input: 'src/index.ts',
          output: { dir: 'dist/cjs', format: 'cjs' as const },
        },
        transformations: [],
      };

      // Mock existsSync to return true for the valid package root
      vi.mocked(existsSync).mockReturnValue(true);

      const result = loader.validateConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid config', () => {
      const invalidConfig = {
        packageRoot: '/nonexistent/path',
        transformations: [
          {
            // Missing type field
            options: {},
          },
          {
            type: 'invalidType',
            options: {},
          },
          {
            type: 'injectDependency',
            // Missing options field
          },
        ],
      } as any;

      // Mock existsSync to return false for the nonexistent path
      vi.mocked(existsSync).mockReturnValue(false);

      const result = loader.validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle JSON parsing errors', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        return pathStr.includes('wdio-bundler.config.json');
      });

      vi.mocked(readFile).mockResolvedValue('{ invalid json }');

      await expect(loader.loadConfig()).rejects.toThrow('Invalid JSON in config file');
    });

    it('should handle TypeScript tsx process failures', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        return pathStr.includes('wdio-bundler.config.ts');
      });

      // Mock spawn to simulate tsx failure
      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stderr: {
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                callback('tsx error output');
              }
            }),
          },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              callback(1); // Non-zero exit code
            }
          }),
        };
        return mockChild;
      });

      await expect(loader.loadConfig()).rejects.toThrow('Failed to load TypeScript config');
    });

    it('should handle TypeScript tsx spawn errors', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        return pathStr.includes('wdio-bundler.config.ts');
      });

      // Mock spawn to simulate process error
      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stderr: { on: vi.fn() },
          on: vi.fn((event, callback) => {
            if (event === 'error') {
              callback(new Error('spawn failed'));
            }
          }),
        };
        return mockChild;
      });

      await expect(loader.loadConfig()).rejects.toThrow('Failed to load TypeScript config');
    });

    it('should clean up temp files even when tsx fails', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        return pathStr.includes('wdio-bundler.config.ts');
      });

      // Mock spawn to simulate tsx failure
      mockSpawn.mockImplementation(() => ({
        stderr: {
          on: vi.fn((event, callback) => {
            if (event === 'data') callback('tsx error');
          }),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(1);
        }),
      }));

      await expect(loader.loadConfig()).rejects.toThrow('Failed to load TypeScript config');

      // Should still attempt cleanup
      expect(mockUnlinkSync).toHaveBeenCalled();
    });

    it('should handle JSON parsing errors in TypeScript config', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        return pathStr.includes('wdio-bundler.config.ts');
      });

      mockSpawn.mockImplementation(() => ({
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      }));

      // Mock invalid JSON in temp file
      mockReadFileSync.mockReturnValue('{ invalid json }');

      await expect(loader.loadConfig()).rejects.toThrow('Failed to load TypeScript config');
    });
  });

  describe('validateConfig', () => {
    it('should validate transformation types', () => {
      const config = {
        packageRoot: '/test/cwd',
        transformations: [
          { type: 'injectDependency', options: {} },
          { type: 'codeReplace', options: {} },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      const result = loader.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing transformation options', () => {
      const config = {
        packageRoot: '/test/cwd',
        transformations: [
          { type: 'injectDependency' }, // Missing options
        ],
      } as any;

      vi.mocked(existsSync).mockReturnValue(true);
      const result = loader.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Transformation 0: missing options');
    });

    it('should detect invalid transformation types', () => {
      const config = {
        packageRoot: '/test/cwd',
        transformations: [{ type: 'unknownType', options: {} }],
      } as any;

      vi.mocked(existsSync).mockReturnValue(true);
      const result = loader.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Transformation 0: invalid type 'unknownType'");
    });
  });
});
