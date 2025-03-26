import { normalize } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { ABinaryPathGenerator, ExecutableBinaryPath } from '../../src/binary/binary';
import { selectExecutable } from '../../src/binary/select';

import type { AppBuildInfo } from '@wdio/electron-types';
import type { SupportedPlatform } from '../../src/types';

vi.mock('../../src/binary/select', () => {
  return {
    selectExecutable: vi.fn(),
  };
});

describe('ExecutableBinaryPath', () => {
  it('should return the path of executable', async () => {
    const expectedArray = ['/path/to/executable1', '/path/to/executable2'];
    vi.mocked(selectExecutable).mockResolvedValue(expectedArray[0]);
    const mockBinaryPathGenerator = {
      generate: vi.fn().mockReturnValue(expectedArray),
    };
    const testTargetClass = new ExecutableBinaryPath(mockBinaryPathGenerator);
    const result = await testTargetClass.get();

    expect(mockBinaryPathGenerator.generate).toHaveBeenCalledTimes(1);
    expect(selectExecutable).toHaveBeenCalledWith(expectedArray);
    expect(result).toBe(expectedArray[0]);
  });
});

describe('ABinaryPathGenerator', () => {
  class MockBinaryPathGenerator extends ABinaryPathGenerator {
    protected getOutDir(): string[] {
      return ['/path/to/dir1', '/path/to/dir2'];
    }
    protected getBinaryName(): string {
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
    expect(result).toStrictEqual(
      ['/path/to/dir1/my-app.app/Contents/MacOS/my-app', '/path/to/dir2/my-app.app/Contents/MacOS/my-app'].map((p) =>
        normalize(p),
      ),
    );
  });

  it('should return a binary paths for the Windows', async () => {
    const mockClass = generateMockInstance('win32');
    const result = mockClass.generate();
    expect(result).toStrictEqual(['/path/to/dir1/my-app.exe', '/path/to/dir2/my-app.exe'].map((p) => normalize(p)));
  });

  it('should return a binary paths for the Linux', async () => {
    const mockClass = generateMockInstance('linux');
    const result = mockClass.generate();
    expect(result).toStrictEqual(['/path/to/dir1/my-app', '/path/to/dir2/my-app'].map((p) => normalize(p)));
  });
});
