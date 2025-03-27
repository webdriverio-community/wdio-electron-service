import { normalize } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { ABinaryPathGenerator, ExecutablePath } from '../../src/binary/binary';
import { selectExecutablePath } from '../../src/binary/selectExecutablePath';

import type { AppBuildInfo } from '@wdio/electron-types';
import type { SupportedPlatform } from '../../src/types';

vi.mock('../../src/binary/selectExecutablePath', () => {
  return {
    selectExecutablePath: vi.fn(),
  };
});

describe('ExecutablePath', () => {
  it('should return the path of executable', async () => {
    vi.mocked(selectExecutablePath).mockResolvedValue('/path/to/executable1');
    const mockBinaryPathGenerator = {
      generate: vi.fn().mockReturnValue(['/path/to/executable1', '/path/to/executable2']),
    };
    const testTargetClass = new ExecutablePath(mockBinaryPathGenerator);
    const result = await testTargetClass.get();

    expect(mockBinaryPathGenerator.generate).toHaveBeenCalledTimes(1);
    expect(selectExecutablePath).toHaveBeenCalledWith(['/path/to/executable1', '/path/to/executable2']);
    expect(result).toBe('/path/to/executable1');
  });
});

describe('ABinaryPathGenerator', () => {
  class MockBinaryPathGenerator extends ABinaryPathGenerator {
    protected getOutDir(): string[] {
      return ['/path/to/dir1', '/path/to/dir2'];
    }
    protected selectExecutablePathName(): string {
      return 'my-app';
    }
  }

  function generateMockInstance(platform: SupportedPlatform) {
    return new MockBinaryPathGenerator({
      platform,
      electronVersion: '29.3.1',
      packageJsonPath: '/path/to/package.json',
      appBuildInfo: {
        appName: 'my-app',
      } as unknown as AppBuildInfo,
    });
  }

  it('should return a binary paths for the MacOS', async () => {
    const mockClass = generateMockInstance('darwin');
    const result = mockClass.generate();
    expect(result.map((p) => normalize(p))).toStrictEqual([
      '/path/to/dir1/my-app.app/Contents/MacOS/my-app',
      '/path/to/dir2/my-app.app/Contents/MacOS/my-app',
    ]);
  });

  it('should return a binary paths for the Windows', async () => {
    const mockClass = generateMockInstance('win32');
    const result = mockClass.generate();
    expect(result.map((p) => normalize(p))).toStrictEqual(['/path/to/dir1/my-app.exe', '/path/to/dir2/my-app.exe']);
  });

  it('should return a binary paths for the Linux', async () => {
    const mockClass = generateMockInstance('linux');
    const result = mockClass.generate();
    expect(result.map((p) => normalize(p))).toStrictEqual(['/path/to/dir1/my-app', '/path/to/dir2/my-app']);
  });
});
