import path, { normalize } from 'node:path';
import fs from 'node:fs/promises';
import { expect, it, vi } from 'vitest';
import { BuilderBinaryOptions, ForgeBinaryOptions } from '../src/types';
import { ForgeBinaryPathGenerator } from '../src/binary/forge';
import { BuilderBinaryPathGenerator } from '../src/binary/builder';
import { AppBuildInfo } from '@wdio/electron-types';
import { ExecutableBinaryPath } from '../src/binary/binary';

export async function getFixturePackageJson(moduleType: string, fixtureName: string) {
  const packageJsonPath = path.resolve(process.cwd(), '..', '..', 'fixtures', moduleType, fixtureName, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  return {
    packageJson,
    path: packageJsonPath,
  };
}

export type TestBinaryPathOptions = {
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

export function mockBinaryPath(expectedPath: string | string[]) {
  const target = Array.isArray(expectedPath) ? expectedPath.map((p) => normalize(p)) : [normalize(expectedPath)];
  vi.mocked(fs.access).mockImplementation(async (path, _mode?) => {
    if (target.includes(normalize(path.toString()))) {
      return Promise.resolve();
    } else {
      return Promise.reject('Not executable');
    }
  });
}

export function testBinaryPath(options: TestBinaryPathOptions) {
  const { platform, arch, binaryPath, isForge, configObj, testName, skip } = options;
  const buildType = isForge ? 'Forge' : 'builder';
  const hasCustomOutDir = configObj.outDir || (configObj.directories && configObj.directories.output);
  const pkgJSONPath = '/path/to/package.json';

  // Create test title based on config properties
  const title =
    testName ||
    (hasCustomOutDir
      ? `should return the expected app path for a ${buildType} setup with custom output directory`
      : `should return the expected path for a ${buildType} setup on ${platform}-${arch}`);

  // Use skip for known problematic tests
  const testFn = skip ? it.skip : it;

  testFn(`${title}`, async () => {
    const currentProcess = { platform, arch } as NodeJS.Process;
    mockBinaryPath(binaryPath);

    const options = {
      packageJsonPath: pkgJSONPath,
      appBuildInfo: {
        appName: 'my-app',
        isForge: isForge,
        isBuilder: !isForge,
        config: configObj,
      } as AppBuildInfo,
      electronVersion: '29.3.1',
      platform: currentProcess.platform,
    } as unknown;

    const targetClass = isForge
      ? new ForgeBinaryPathGenerator(options as ForgeBinaryOptions)
      : new BuilderBinaryPathGenerator(options as BuilderBinaryOptions);

    const definer = new ExecutableBinaryPath(targetClass);

    const result = await definer.get();

    // Normalize path separators for cross-platform compatibility
    const normalizedActual = result.replace(/\\/g, '/');
    const normalizedExpected = binaryPath.replace(/\\/g, '/');

    expect(normalizedActual).toBe(normalizedExpected);
  });
}
