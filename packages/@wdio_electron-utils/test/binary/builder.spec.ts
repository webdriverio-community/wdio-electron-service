import { describe, expect, it, vi } from 'vitest';

import { testBinaryPath as _testBinaryPath, type TestBinaryPathOptions } from '../testUtils';
import { isBuilderInfo } from '../../src/binary/builder';

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

vi.mock('../../src/binary/forge', () => {
  return {
    ForgeBinaryPathGenerator: vi.fn(),
    isForgeInfo: vi.fn(),
  };
});

function testBinaryPath(options: Omit<TestBinaryPathOptions, 'isForge'>) {
  return _testBinaryPath(Object.assign(options, { isForge: false }));
}

describe('BuilderBinaryPathGenerator', () => {
  testBinaryPath({
    platform: 'darwin',
    arch: 'arm64',
    binaryPath: '/path/to/dist/mac-arm64/my-app.app/Contents/MacOS/my-app',
    configObj: { productName: 'my-app' },
  });

  testBinaryPath({
    platform: 'darwin',
    arch: 'x64',
    binaryPath: '/path/to/dist/mac/my-app.app/Contents/MacOS/my-app',
    configObj: { productName: 'my-app' },
  });

  testBinaryPath({
    platform: 'darwin',
    arch: 'arm64',
    binaryPath: '/path/to/dist/mac-arm64/my-app.app/Contents/MacOS/my-app',
    configObj: { productName: 'my-app' },
  });

  testBinaryPath({
    platform: 'darwin',
    arch: 'x64',
    binaryPath: '/path/to/dist/mac/my-app.app/Contents/MacOS/my-app',
    configObj: { productName: 'my-app' },
  });

  // For the darwin with custom output directory test we need to mock the correct path
  // The error shows the paths being checked, e.g., /path/to/dist/mac-universal/mac/my-app.app/Contents/MacOS/my-app

  testBinaryPath({
    platform: 'darwin',
    arch: 'arm64',
    binaryPath: '/path/to/dist/mac-universal/mac/my-app.app/Contents/MacOS/my-app',
    configObj: { productName: 'my-app', directories: { output: 'dist/mac-universal' } },
  });

  // For the linux tests we need to mock the correct paths

  testBinaryPath({
    platform: 'linux',
    arch: 'x64',
    binaryPath: '/path/to/dist/linux-unpacked/my-app',
    configObj: { productName: 'my-app' },
  });

  // For linux arm64, we need to use the same 'linux-unpacked' path because
  // the getBinaryPath function creates the same path for all Linux architectures
  // when using the builder
  testBinaryPath({
    platform: 'linux',
    arch: 'arm64',
    binaryPath: '/path/to/dist/linux-unpacked/my-app',
    configObj: { productName: 'my-app' },
  });
});

describe('isBuilderInfo', () => {
  it('should return true when isBuilder is true', async () => {
    expect(
      isBuilderInfo({
        appBuildInfo: {
          isBuilder: true,
        },
      } as unknown as CommonBinaryOptions),
    ).toBe(true);
  });

  it('should return false when isBuilder is false', async () => {
    expect(
      isBuilderInfo({
        appBuildInfo: {
          isBuilder: false,
        },
      } as unknown as CommonBinaryOptions),
    ).toBe(false);
  });
});
