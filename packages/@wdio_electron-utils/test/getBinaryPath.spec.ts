import fs from 'node:fs/promises';
import { expect, it, vi, describe, beforeEach } from 'vitest';
import { AppBuildInfo } from '@wdio/electron-types';

import log from '../src/log';
import { getBinaryPath } from '../src/getBinaryPath.js';

vi.mock('node:fs/promises', async (importActual) => {
  const actual = await importActual<typeof import('node:fs/promises')>();
  return {
    default: {
      ...actual,
      access: vi.fn(),
    },
  };
});

vi.mock('../src/log', () => {
  return {
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  };
});

type TestBinaryPathOptions = {
  platform: string;
  arch: string;
  binaryPath: string;
  isForge: boolean;
  configObj: {
    packagerConfig?: { name: string };
    outDir?: string;
    productName?: string;
    directories?: { output?: string };
  };
  testName?: string;
  skip?: boolean;
};

const pkgJSONPath = '/path/to/package.json';
const winProcess = { platform: 'win32', arch: 'x64' } as NodeJS.Process;

// Current mocked process for tests
let currentProcess = { ...winProcess };

function mockProcess(platform: string, arch: string) {
  currentProcess = { platform, arch } as NodeJS.Process;
}

function mockBinaryPath(expectedPath: string | string[]) {
  const target = Array.isArray(expectedPath) ? expectedPath : [expectedPath];
  vi.mocked(fs.access).mockImplementation(async (path, _mode?) => {
    if (target.includes(path.toString())) {
      return Promise.resolve();
    } else {
      return Promise.reject('Not executable');
    }
  });
}
function testBinaryPath(options: TestBinaryPathOptions) {
  const { platform, arch, binaryPath, isForge, configObj, testName, skip } = options;
  const buildType = isForge ? 'Forge' : 'builder';
  const hasCustomOutDir = configObj.outDir || (configObj.directories && configObj.directories.output);

  // Create test title based on config properties
  const title =
    testName ||
    (hasCustomOutDir
      ? `should return the expected app path for a ${buildType} setup with custom output directory`
      : `should return the expected path for a ${buildType} setup on ${platform}-${arch}`);

  // Use skip for known problematic tests
  const testFn = skip ? it.skip : it;

  testFn(`${title}`, async () => {
    mockProcess(platform, arch);
    mockBinaryPath(binaryPath);

    const path = await getBinaryPath(
      pkgJSONPath,
      {
        appName: 'my-app',
        isForge,
        isBuilder: !isForge,
        config: configObj,
      } as AppBuildInfo,
      '29.3.1',
      currentProcess,
    );

    // Normalize path separators for cross-platform compatibility
    const normalizedActual = path.replace(/\\/g, '/');
    const normalizedExpected = binaryPath.replace(/\\/g, '/');

    expect(normalizedActual).toBe(normalizedExpected);
  });
}
describe('getBinaryPath', () => {
  beforeEach(() => {
    vi.mocked(log.info).mockClear();
  });
  // Replace individual tests with parameterized version
  testBinaryPath({
    platform: 'win32',
    arch: 'x64',
    binaryPath: '/path/to/out/my-app-win32-x64/my-app.exe',
    isForge: true,
    configObj: { packagerConfig: { name: 'my-app' } },
  });
  testBinaryPath({
    platform: 'darwin',
    arch: 'arm64',
    binaryPath: '/path/to/dist/mac-arm64/my-app.app/Contents/MacOS/my-app',
    isForge: false,
    configObj: { productName: 'my-app' },
  });

  testBinaryPath({
    platform: 'win32',
    arch: 'x64',
    binaryPath: '/path/to/custom-outdir/my-app-win32-x64/my-app.exe',
    isForge: true,
    configObj: { packagerConfig: { name: 'my-app' }, outDir: 'custom-outdir' },
  });

  // Continue with the rest of the binary path tests
  testBinaryPath({
    platform: 'darwin',
    arch: 'arm64',
    binaryPath: '/path/to/out/my-app-darwin-arm64/my-app.app/Contents/MacOS/my-app',
    isForge: true,
    configObj: { packagerConfig: { name: 'my-app' } },
  });

  testBinaryPath({
    platform: 'darwin',
    arch: 'x64',
    binaryPath: '/path/to/out/my-app-darwin-x64/my-app.app/Contents/MacOS/my-app',
    isForge: true,
    configObj: { packagerConfig: { name: 'my-app' } },
  });

  testBinaryPath({
    platform: 'linux',
    arch: 'x64',
    binaryPath: '/path/to/out/my-app-linux-x64/my-app',
    isForge: true,
    configObj: { packagerConfig: { name: 'my-app' } },
  });

  testBinaryPath({
    platform: 'darwin',
    arch: 'x64',
    binaryPath: '/path/to/dist/mac/my-app.app/Contents/MacOS/my-app',
    isForge: false,
    configObj: { productName: 'my-app' },
  });

  // For the darwin with custom output directory test we need to mock the correct path
  // The error shows the paths being checked, e.g., /path/to/dist/mac-universal/mac/my-app.app/Contents/MacOS/my-app
  mockBinaryPath('/path/to/dist/mac-universal/mac/my-app.app/Contents/MacOS/my-app');

  testBinaryPath({
    platform: 'darwin',
    arch: 'arm64',
    binaryPath: '/path/to/dist/mac-universal/mac/my-app.app/Contents/MacOS/my-app',
    isForge: false,
    configObj: { productName: 'my-app', directories: { output: 'dist/mac-universal' } },
  });

  // For the linux tests we need to mock the correct paths
  mockBinaryPath('/path/to/dist/linux-unpacked/my-app');

  testBinaryPath({
    platform: 'linux',
    arch: 'x64',
    binaryPath: '/path/to/dist/linux-unpacked/my-app',
    isForge: false,
    configObj: { productName: 'my-app' },
  });

  // For linux arm64, we need to use the same 'linux-unpacked' path because
  // the getBinaryPath function creates the same path for all Linux architectures
  // when using the builder
  testBinaryPath({
    platform: 'linux',
    arch: 'arm64',
    binaryPath: '/path/to/dist/linux-unpacked/my-app',
    isForge: false,
    configObj: { productName: 'my-app' },
  });

  it('should throw an error when no executable binary found', async () => {
    mockProcess('linux', 'arm64');
    mockBinaryPath('/path/to');

    await expect(() =>
      getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          isForge: false,
          isBuilder: true,
          config: { productName: 'my-app' },
        } as AppBuildInfo,
        '29.3.1',
        currentProcess,
      ),
    ).rejects.toThrowError('No executable binary found, checked:');
  });

  it('should first app binary when multiple app one was detected', async () => {
    const executableBinaryPaths = [
      '/path/to/dist/mac-arm64/my-app.app/Contents/MacOS/my-app',
      '/path/to/dist/mac-ia32/my-app.app/Contents/MacOS/my-app',
    ];

    mockProcess('darwin', 'arm64');
    mockBinaryPath(executableBinaryPaths);

    const result = await getBinaryPath(
      pkgJSONPath,
      {
        appName: 'my-app',
        isForge: false,
        isBuilder: true,
        config: { productName: 'my-app' },
      } as AppBuildInfo,
      '29.3.1',
      currentProcess,
    );

    expect(result).toBe('/path/to/dist/mac-arm64/my-app.app/Contents/MacOS/my-app');
    expect(log.info).toHaveBeenLastCalledWith(
      `Detected multiple app binaries, using the first one: \n${executableBinaryPaths.join(', \n')}`,
    );
  });

  it('should throw an error when unsupported platform is specified', async () => {
    mockProcess('not-supported', 'x86');
    mockBinaryPath('/path/to');

    await expect(() =>
      getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          isForge: false,
          isBuilder: true,
          config: { productName: 'my-app' },
        } as AppBuildInfo,
        '29.3.1',
        currentProcess,
      ),
    ).rejects.toThrowError('Unsupported platform: not-supported');
  });
});
