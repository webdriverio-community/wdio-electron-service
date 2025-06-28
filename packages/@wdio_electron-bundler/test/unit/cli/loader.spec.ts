import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { ConfigLoader } from '../../../src/cli/loader.js';
import { Logger } from '../../../src/cli/logger.js';

// Mock fs for tests
vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: {
      on: vi.fn((event, callback) => {
        if (event === 'data') {
          callback('{"esm": {"input": "src/index.ts"}, "cjs": {"input": "src/index.ts"}}');
        }
      }),
    },
    stderr: { on: vi.fn() },
    on: vi.fn((event, callback) => {
      if (event === 'close') {
        callback(0); // Success
      }
    }),
  })),
}));

describe('ConfigLoader', () => {
  let loader: ConfigLoader;
  let logger: Logger;

  beforeEach(() => {
    logger = Logger.create();
    loader = new ConfigLoader('/test/cwd', logger);
    vi.clearAllMocks();

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

      const config = await loader.loadConfig();
      expect(config).toBeDefined();
      expect(config.esm).toBeDefined();
      expect(config.cjs).toBeDefined();
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
      const { spawn } = await import('node:child_process');
      const mockSpawn = vi.mocked(spawn);

      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: vi.fn() },
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
        return mockChild as any;
      });

      await expect(loader.loadConfig()).rejects.toThrow('Failed to load TypeScript config');
    });

    it('should handle TypeScript tsx spawn errors', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        return pathStr.includes('wdio-bundler.config.ts');
      });

      // Mock spawn to simulate process error
      const { spawn } = await import('node:child_process');
      const mockSpawn = vi.mocked(spawn);

      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on: vi.fn((event, callback) => {
            if (event === 'error') {
              callback(new Error('spawn failed'));
            }
          }),
        };
        return mockChild as any;
      });

      await expect(loader.loadConfig()).rejects.toThrow('Failed to load TypeScript config');
    });
  });
});
