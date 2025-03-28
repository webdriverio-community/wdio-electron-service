import { describe, expect, it, vi } from 'vitest';

import { testBinaryPath as _testBinaryPath, type TestBinaryPathOptions } from '../testUtils';
import { isForgeInfo } from '../../src/binary/forge';

import type { CommonBinaryOptions } from '../../src/types';

vi.mock('node:fs/promises', async (importActual) => {
  const actual = await importActual<typeof import('node:fs/promises')>();
  return {
    default: {
      ...actual,
      access: vi.fn(),
    },
  };
});

vi.mock('../../src/log');

vi.mock('../../src/binary/builder', () => {
  return {
    BuilderBinaryPathGenerator: vi.fn(),
    isBuilderInfo: vi.fn(),
  };
});

function testBinaryPath(options: Omit<TestBinaryPathOptions, 'isForge'>) {
  return _testBinaryPath(Object.assign(options, { isForge: true }));
}

describe('ForgeBinaryPathGenerator', () => {
  // Replace individual tests with parameterized version
  testBinaryPath({
    platform: 'win32',
    arch: 'x64',
    binaryPath: '/path/to/out/my-app-win32-x64/my-app.exe',
    configObj: { packagerConfig: { name: 'my-app' } },
  });

  testBinaryPath({
    platform: 'win32',
    arch: 'x64',
    binaryPath: '/path/to/custom-outdir/my-app-win32-x64/my-app.exe',
    configObj: { packagerConfig: { name: 'my-app' }, outDir: 'custom-outdir' },
  });

  // Continue with the rest of the binary path tests
  testBinaryPath({
    platform: 'darwin',
    arch: 'arm64',
    binaryPath: '/path/to/out/my-app-darwin-arm64/my-app.app/Contents/MacOS/my-app',
    configObj: { packagerConfig: { name: 'my-app' } },
  });

  testBinaryPath({
    platform: 'darwin',
    arch: 'x64',
    binaryPath: '/path/to/out/my-app-darwin-x64/my-app.app/Contents/MacOS/my-app',
    configObj: { packagerConfig: { name: 'my-app' } },
  });

  testBinaryPath({
    platform: 'linux',
    arch: 'x64',
    binaryPath: '/path/to/out/my-app-linux-x64/my-app',
    configObj: { packagerConfig: { name: 'my-app' } },
  });
});

describe('isForgeInfo', () => {
  it('should return true when isForge is true', async () => {
    expect(
      isForgeInfo({
        appBuildInfo: {
          isForge: true,
        },
      } as unknown as CommonBinaryOptions),
    ).toBe(true);
  });

  it('should return false when isForge is false', async () => {
    expect(
      isForgeInfo({
        appBuildInfo: {
          isForge: false,
        },
      } as unknown as CommonBinaryOptions),
    ).toBe(false);
  });
});
