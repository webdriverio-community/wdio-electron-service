import fs from 'node:fs/promises';
import { normalize } from 'node:path';
import type { AppBuildInfo } from '@wdio/electron-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBinaryPath } from '../src/binaryPath.js';

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

const pkgJSONPath = '/path/to/package.json';
const winProcess = { platform: 'win32', arch: 'x64' } as NodeJS.Process;

// Mock the current process for testing different platforms and architectures
let currentProcess = { ...winProcess };

/**
 * Updates the mocked process with specified platform and architecture
 * @param platform - The operating system platform (e.g., 'win32', 'darwin', 'linux')
 * @param arch - The CPU architecture (e.g., 'x64', 'arm64')
 */
function mockProcess(platform: string, arch: string) {
  currentProcess = { platform, arch } as NodeJS.Process;
}

/**
 * Mocks the file system access to simulate executable binary paths
 * @param expectedPath - The expected binary path(s) that should be accessible
 */
function mockBinaryPath(expectedPath: string | string[]) {
  const target = Array.isArray(expectedPath) ? expectedPath.map((p) => normalize(p)) : [normalize(expectedPath)];
  vi.mocked(fs.access).mockImplementation(async (path, _mode?) => {
    if (target.includes(normalize(path.toString()))) {
      return Promise.resolve();
    } else {
      return Promise.reject('Not executable');
    }
  });
}

/**
 * Generates a mock AppBuildInfo object for testing
 * @param isForge - Whether the app is built with Electron Forge
 * @param isBuilder - Whether the app is built with electron-builder
 */
function generateAppBuildInfo(isForge: boolean, isBuilder: boolean) {
  return {
    appName: 'my-app',
    isForge,
    isBuilder,
    config: { productName: 'my-app' },
  } as AppBuildInfo;
}

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

/**
 * Helper function to create parameterized tests for binary path resolution
 */
function testBinaryPath(options: TestBinaryPathOptions) {
  const { platform, arch, binaryPath, isForge, configObj, testName, skip } = options;
  const buildType = isForge ? 'Forge' : 'Builder';
  const hasCustomOutDir = configObj.outDir || configObj.directories?.output;
  const pkgJSONPath = '/path/to/package.json';

  // Create descriptive test title based on configuration
  const title =
    testName ||
    (hasCustomOutDir
      ? `should resolve binary path for ${buildType} build with custom output directory on ${platform}-${arch}`
      : `should resolve binary path for ${buildType} build on ${platform}-${arch}`);

  const testFn = skip ? it.skip : it;

  testFn(`${title}`, async () => {
    const currentProcess = { platform } as NodeJS.Process;
    // Mock all possible paths for the current platform
    const allPossiblePaths = [binaryPath];
    if (platform === 'linux') {
      // For Linux, also mock the kebab-case version of the path
      const appName = configObj.packagerConfig?.name || configObj.productName || 'my-app';
      const kebabCaseName = appName.toLowerCase().replace(/ /g, '-');
      const kebabCasePath = binaryPath.replace(appName, kebabCaseName);
      allPossiblePaths.push(kebabCasePath);
    }
    mockBinaryPath(allPossiblePaths);

    const result = await getBinaryPath(
      pkgJSONPath,
      {
        appName: configObj.packagerConfig?.name || configObj.productName || 'my-app',
        isForge: isForge,
        isBuilder: !isForge,
        config: configObj,
      } as AppBuildInfo,
      '29.3.1',
      currentProcess,
    );

    // Verify the result is successful
    expect(result.success).toBe(true);
    expect(result.binaryPath).toBeDefined();

    // Normalize path separators for cross-platform compatibility
    const normalizedActual = result.binaryPath?.replace(/\\/g, '/');
    const normalizedExpected = binaryPath.replace(/\\/g, '/');

    expect(normalizedActual).toBe(normalizedExpected);
  });
}

/**
 * Helper function to create tests specifically for Electron Forge builds
 */
function testForgeBinaryPath(options: Omit<TestBinaryPathOptions, 'isForge'>) {
  testBinaryPath(Object.assign(options, { isForge: true }));
}

/**
 * Helper function to create tests specifically for electron-builder builds
 */
function testBuilderBinaryPath(options: Omit<TestBinaryPathOptions, 'isForge'>) {
  testBinaryPath(Object.assign(options, { isForge: false }));
}

describe('getBinaryPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error result for unsupported platform', async () => {
    mockProcess('not-supported', 'x86');
    mockBinaryPath('/path/to');

    const result = await getBinaryPath(pkgJSONPath, generateAppBuildInfo(false, true), '29.3.1', currentProcess);

    expect(result.success).toBe(false);
    expect(result.binaryPath).toBeUndefined();
    expect(result.pathGeneration.success).toBe(false);
    expect(result.pathGeneration.errors).toContainEqual({
      type: 'UNSUPPORTED_PLATFORM',
      message: 'Unsupported platform: not-supported',
    });
  });

  it('should return error result for unsupported build tool configuration', async () => {
    mockProcess('linux', 'arm64');
    mockBinaryPath('/path/to');

    const result = await getBinaryPath(pkgJSONPath, generateAppBuildInfo(false, false), '29.3.1', currentProcess);

    expect(result.success).toBe(false);
    expect(result.binaryPath).toBeUndefined();
    expect(result.pathGeneration.success).toBe(false);
    expect(result.pathGeneration.errors).toContainEqual({
      type: 'NO_BUILD_TOOL',
      message: 'Configurations that are neither Forge nor Builder are not supported.',
    });
  });

  describe('Electron Forge builds', () => {
    testForgeBinaryPath({
      platform: 'win32',
      arch: 'x64',
      binaryPath: '/path/to/out/my-app-win32-x64/my-app.exe',
      configObj: { packagerConfig: { name: 'my-app' } },
    });

    testForgeBinaryPath({
      platform: 'win32',
      arch: 'x64',
      binaryPath: '/path/to/custom-outdir/my-app-win32-x64/my-app.exe',
      configObj: { packagerConfig: { name: 'my-app' }, outDir: 'custom-outdir' },
    });

    testForgeBinaryPath({
      platform: 'darwin',
      arch: 'arm64',
      binaryPath: '/path/to/out/my-app-darwin-arm64/my-app.app/Contents/MacOS/my-app',
      configObj: { packagerConfig: { name: 'my-app' } },
    });

    testForgeBinaryPath({
      platform: 'darwin',
      arch: 'x64',
      binaryPath: '/path/to/out/my-app-darwin-x64/my-app.app/Contents/MacOS/my-app',
      configObj: { packagerConfig: { name: 'my-app' } },
    });

    testForgeBinaryPath({
      platform: 'linux',
      arch: 'x64',
      binaryPath: '/path/to/out/my-app-linux-x64/my-app',
      configObj: { packagerConfig: { name: 'my-app' } },
    });

    // Test Linux with spaces in name
    testForgeBinaryPath({
      platform: 'linux',
      arch: 'x64',
      binaryPath: '/path/to/out/builder-app-example-linux-x64/builder-app-example',
      configObj: { packagerConfig: { name: 'Builder App Example' } },
    });
  });

  describe('electron-builder builds', () => {
    // Test all supported macOS architectures
    testBuilderBinaryPath({
      platform: 'darwin',
      arch: 'arm64',
      binaryPath: '/path/to/dist/mac-arm64/my-app.app/Contents/MacOS/my-app',
      configObj: { productName: 'my-app' },
    });

    testBuilderBinaryPath({
      platform: 'darwin',
      arch: 'x64',
      binaryPath: '/path/to/dist/mac/my-app.app/Contents/MacOS/my-app',
      configObj: { productName: 'my-app' },
    });

    testBuilderBinaryPath({
      platform: 'darwin',
      arch: 'armv7l',
      binaryPath: '/path/to/dist/mac-armv7l/my-app.app/Contents/MacOS/my-app',
      configObj: { productName: 'my-app' },
    });

    testBuilderBinaryPath({
      platform: 'darwin',
      arch: 'ia32',
      binaryPath: '/path/to/dist/mac-ia32/my-app.app/Contents/MacOS/my-app',
      configObj: { productName: 'my-app' },
    });

    testBuilderBinaryPath({
      platform: 'darwin',
      arch: 'universal',
      binaryPath: '/path/to/dist/mac-universal/my-app.app/Contents/MacOS/my-app',
      configObj: { productName: 'my-app' },
    });

    // Test custom output directory configuration
    testBuilderBinaryPath({
      platform: 'darwin',
      arch: 'arm64',
      binaryPath: '/path/to/dist/custom/mac/my-app.app/Contents/MacOS/my-app',
      configObj: { productName: 'my-app', directories: { output: 'dist/custom' } },
    });

    // Test Linux builds (note: all Linux architectures use the same output path)
    testBuilderBinaryPath({
      platform: 'linux',
      arch: 'x64',
      binaryPath: '/path/to/dist/linux-unpacked/my-app',
      configObj: { productName: 'my-app' },
    });

    // Test Linux with spaces in name
    testBuilderBinaryPath({
      platform: 'linux',
      arch: 'x64',
      binaryPath: '/path/to/dist/linux-unpacked/builder-app-example',
      configObj: { productName: 'Builder App Example' },
    });

    testBuilderBinaryPath({
      platform: 'linux',
      arch: 'arm64',
      binaryPath: '/path/to/dist/linux-unpacked/my-app',
      configObj: { productName: 'my-app' },
    });

    // Test macOS with executableName
    testBuilderBinaryPath({
      platform: 'darwin',
      arch: 'arm64',
      binaryPath: '/path/to/dist/mac-arm64/builder-app-example.app/Contents/MacOS/builder-app-example',
      configObj: {
        productName: 'Builder App Example',
        executableName: 'builder-app-example',
      } as any,
    });

    // Test Windows with executableName
    testBuilderBinaryPath({
      platform: 'win32',
      arch: 'x64',
      binaryPath: '/path/to/dist/win-unpacked/builder-app-example.exe',
      configObj: {
        productName: 'Builder App Example',
        executableName: 'builder-app-example',
      } as any,
    });
  });
});
