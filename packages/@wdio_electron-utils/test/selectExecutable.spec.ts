import fs from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { selectExecutable } from '../src/selectExecutable.js';
import { mockBinaryPath } from './testUtils.js';

/**
 * Mock the file system promises module to control file access checks
 */
vi.mock('node:fs/promises', async (importActual) => {
  const actual = await importActual<typeof import('node:fs/promises')>();
  return {
    default: {
      ...actual,
      access: vi.fn(),
    },
  };
});

vi.mock('../src/log.js', () => import('./__mock__/log.js'));

/**
 * Mock the binary path generator classes and utilities
 */
vi.mock('../../src/binary/binary', () => {
  return {
    ABinaryPathGenerator: vi.fn(),
    ExecutableBinaryPath: vi.fn(),
  };
});

vi.mock('../../src/binary/forge', () => {
  return {
    ForgeBinaryPathGenerator: vi.fn(),
    isForgeInfo: vi.fn(),
  };
});

vi.mock('../../src/binary/builder', () => {
  return {
    BuilderBinaryPathGenerator: vi.fn(),
    isBuilderInfo: vi.fn(),
  };
});

describe('selectExecutable', () => {
  it('should select first executable when multiple binaries are detected', async () => {
    const executableBinaryPaths = [
      '/path/to/dist/mac-arm64/my-app.app/Contents/MacOS/my-app',
      '/path/to/dist/mac-ia32/my-app.app/Contents/MacOS/my-app',
    ];
    mockBinaryPath(executableBinaryPaths);

    const result = await selectExecutable(executableBinaryPaths);

    expect(result).toBe(executableBinaryPaths[0]);
    const { createLogger } = await import('./__mock__/log.js');
    const mockLogger = createLogger();
    expect(mockLogger.info).toHaveBeenLastCalledWith(
      expect.stringMatching(/Detected multiple app binaries, using the first one:/),
    );
  });

  it('should throw error when no executable binary is found', async () => {
    // Create a proper ENOENT error for the mock
    const enoentError = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
    enoentError.code = 'ENOENT';
    vi.mocked(fs.access).mockRejectedValue(enoentError);

    await expect(() => selectExecutable(['/path/to/dist'])).rejects.toThrowError(
      'No executable binary found, checked:',
    );
  });
});
