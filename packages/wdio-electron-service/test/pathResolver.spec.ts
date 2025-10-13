import { access } from 'node:fs/promises';
import type { NormalizedReadResult } from 'read-package-up';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAppPaths, validateFilePath } from '../src/pathResolver.js';

vi.mock('node:fs/promises', () => {
  const mockAccessFn = vi.fn().mockResolvedValue(undefined);
  return {
    access: mockAccessFn,
    default: {
      access: mockAccessFn,
    },
  };
});

describe('pathResolver', () => {
  let mockPkg: NormalizedReadResult;

  beforeEach(() => {
    mockPkg = {
      packageJson: {
        name: 'test-app',
        version: '1.0.0',
        readme: '',
        _id: 'test-app@1.0.0',
      },
      path: '/test/package.json',
    };
  });

  afterEach(() => {
    vi.mocked(access).mockReset().mockResolvedValue(undefined);
  });

  describe('validateFilePath', () => {
    it('should resolve when file exists', async () => {
      const result = await validateFilePath('/path/to/file', 'Test file');
      expect(result).toBe('/path/to/file');
    });

    it('should throw detailed error when file does not exist (ENOENT)', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const error = await validateFilePath('/path/to/missing', 'Test file').catch((e) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch(/Test file not found: \/path\/to\/missing/);
      expect(error.message).toMatch(/The specified test file does not exist/);
      expect(error.message).toMatch(/Current working directory:/);
    });

    it('should throw error when file is not accessible (EACCES)', async () => {
      vi.mocked(access).mockRejectedValueOnce(Object.assign(new Error('EACCES'), { code: 'EACCES' }));

      await expect(validateFilePath('/path/to/restricted', 'Test file')).rejects.toThrow(
        /Permission denied\. The file exists but is not accessible/,
      );
    });

    it('should throw generic error for other access errors', async () => {
      vi.mocked(access).mockRejectedValueOnce(new Error('Unknown error'));

      await expect(validateFilePath('/path/to/file', 'Test file')).rejects.toThrow(/Unable to access file/);
    });
  });

  describe('resolveAppPaths', () => {
    describe('when only appEntryPoint is provided', () => {
      it('should resolve with electron binary and app args', async () => {
        const result = await resolveAppPaths({
          appEntryPoint: '/path/to/app.js',
          appBinaryPath: undefined,
          appArgs: ['--no-sandbox'],
          pkg: mockPkg,
        });

        expect(result.appBinaryPath).toMatch(/node_modules[/\\].bin[/\\]electron/);
        expect(result.appArgs).toEqual(['--app=/path/to/app.js', '--no-sandbox']);
        expect(result.logMessages).toHaveLength(1);
        expect(result.logMessages[0].level).toBe('debug');
      });

      it('should throw error when appEntryPoint does not exist', async () => {
        vi.mocked(access).mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

        await expect(
          resolveAppPaths({
            appEntryPoint: '/path/to/missing.js',
            appBinaryPath: undefined,
            appArgs: ['--no-sandbox'],
            pkg: mockPkg,
          }),
        ).rejects.toThrow(/App entry point not found/);
      });
    });

    describe('when only appBinaryPath is provided', () => {
      it('should resolve with provided binary path', async () => {
        const result = await resolveAppPaths({
          appEntryPoint: undefined,
          appBinaryPath: '/path/to/binary',
          appArgs: ['--no-sandbox'],
          pkg: mockPkg,
        });

        expect(result.appBinaryPath).toBe('/path/to/binary');
        expect(result.appArgs).toEqual(['--no-sandbox']);
        expect(result.logMessages).toHaveLength(0);
      });

      it('should throw error when appBinaryPath does not exist', async () => {
        vi.mocked(access).mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

        await expect(
          resolveAppPaths({
            appEntryPoint: undefined,
            appBinaryPath: '/path/to/missing-binary',
            appArgs: ['--no-sandbox'],
            pkg: mockPkg,
          }),
        ).rejects.toThrow(/App binary not found/);
      });
    });

    describe('when both appEntryPoint and appBinaryPath are provided', () => {
      it('should prefer appEntryPoint when both are valid', async () => {
        const result = await resolveAppPaths({
          appEntryPoint: '/path/to/app.js',
          appBinaryPath: '/path/to/binary',
          appArgs: ['--no-sandbox'],
          pkg: mockPkg,
        });

        expect(result.appBinaryPath).toMatch(/node_modules[/\\].bin[/\\]electron/);
        expect(result.appArgs).toEqual(['--app=/path/to/app.js', '--no-sandbox']);
        expect(result.logMessages).toHaveLength(2);
        expect(result.logMessages[0].message).toContain('using appEntryPoint (appBinaryPath ignored)');
      });

      it('should fall back to appBinaryPath when appEntryPoint is invalid', async () => {
        vi.mocked(access)
          .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })) // appEntryPoint fails
          .mockResolvedValueOnce(undefined); // appBinaryPath succeeds

        const result = await resolveAppPaths({
          appEntryPoint: '/path/to/missing.js',
          appBinaryPath: '/path/to/binary',
          appArgs: ['--no-sandbox'],
          pkg: mockPkg,
        });

        expect(result.appBinaryPath).toBe('/path/to/binary');
        expect(result.appArgs).toEqual(['--no-sandbox']);
        expect(result.logMessages).toHaveLength(2);
        expect(result.logMessages[1].level).toBe('warn');
        expect(result.logMessages[1].message).toContain('falling back to appBinaryPath');
      });

      it('should use appEntryPoint when appBinaryPath is invalid', async () => {
        vi.mocked(access)
          .mockResolvedValueOnce(undefined) // appEntryPoint succeeds
          .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })); // appBinaryPath fails

        const result = await resolveAppPaths({
          appEntryPoint: '/path/to/app.js',
          appBinaryPath: '/path/to/missing-binary',
          appArgs: ['--no-sandbox'],
          pkg: mockPkg,
        });

        expect(result.appBinaryPath).toMatch(/node_modules[/\\].bin[/\\]electron/);
        expect(result.appArgs).toEqual(['--app=/path/to/app.js', '--no-sandbox']);
        expect(result.logMessages).toHaveLength(3); // debug for appBinaryPath failure + info message + debug for entry point
        expect(result.logMessages[1].message).toContain('appBinaryPath is invalid and ignored');
      });

      it('should throw error when both are invalid', async () => {
        vi.mocked(access)
          .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })) // appEntryPoint fails
          .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })); // appBinaryPath fails

        await expect(
          resolveAppPaths({
            appEntryPoint: '/path/to/missing.js',
            appBinaryPath: '/path/to/missing-binary',
            appArgs: ['--no-sandbox'],
            pkg: mockPkg,
          }),
        ).rejects.toThrow(/Both appEntryPoint and appBinaryPath not found/);
      });
    });

    describe('when neither path is provided', () => {
      it('should throw error indicating no paths provided', async () => {
        await expect(
          resolveAppPaths({
            appEntryPoint: undefined,
            appBinaryPath: undefined,
            appArgs: ['--no-sandbox'],
            pkg: mockPkg,
          }),
        ).rejects.toThrow(/No paths provided for resolution/);
      });
    });
  });
});
