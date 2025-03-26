import fs from 'node:fs/promises';
import { normalize } from 'node:path';

import { expect, it, vi, describe, beforeEach } from 'vitest';
import { AppBuildInfo } from '@wdio/electron-types';

import log from '../src/log';
import { getBinaryPath } from '../src/getBinaryPath';
import { ForgeBinaryPathGenerator } from '../src/binary/forge';
import { BuilderBinaryPathGenerator } from '../src/binary/builder';

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

vi.mock('../src/binary/binary', () => {
  return {
    ABinaryPathGenerator: vi.fn(),
    ExecutableBinaryPath: vi.fn(() => {
      return {
        get: vi.fn(),
      };
    }),
  };
});

vi.mock('../src/binary/forge', async (importActual) => {
  const actual = await importActual<typeof import('../src/binary/forge')>();
  return {
    ...actual,
    ForgeBinaryPathGenerator: vi.fn(),
  };
});

vi.mock('../src/binary/builder', async (importActual) => {
  const actual = await importActual<typeof import('../src/binary/builder')>();
  return {
    ...actual,
    BuilderBinaryPathGenerator: vi.fn(),
  };
});

const pkgJSONPath = '/path/to/package.json';
const winProcess = { platform: 'win32', arch: 'x64' } as NodeJS.Process;

// Current mocked process for tests
let currentProcess = { ...winProcess };

function mockProcess(platform: string, arch: string) {
  currentProcess = { platform, arch } as NodeJS.Process;
}

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

function generateAppBuildInfo(isForge: boolean, isBuilder: boolean) {
  return {
    appName: 'my-app',
    isForge,
    isBuilder,
    config: { productName: 'my-app' },
  } as AppBuildInfo;
}

describe('getBinaryPath', () => {
  beforeEach(() => {
    vi.mocked(log.info).mockClear();
  });

  it('should throw an error when unsupported platform is specified', async () => {
    mockProcess('not-supported', 'x86');
    mockBinaryPath('/path/to');

    await expect(() =>
      getBinaryPath(pkgJSONPath, generateAppBuildInfo(false, true), '29.3.1', currentProcess),
    ).rejects.toThrowError('Unsupported platform: not-supported');
  });

  it('should throw an error when unsupported build tool neither Forge nor Builder', async () => {
    mockProcess('linux', 'arm64');
    mockBinaryPath('/path/to');

    await expect(() =>
      getBinaryPath(pkgJSONPath, generateAppBuildInfo(false, false), '29.3.1', currentProcess),
    ).rejects.toThrowError('Configurations that are neither Forge nor Builder are not supported.');
  });

  it('should use a class for the Forge when isForge is set true', async () => {
    mockProcess('linux', 'arm64');
    mockBinaryPath('/path/to');
    getBinaryPath(pkgJSONPath, generateAppBuildInfo(true, false), '29.3.1', currentProcess);

    expect(ForgeBinaryPathGenerator).toHaveBeenCalledTimes(1);
  });

  it('should use a class for the Builder when isBuilder is set true', async () => {
    mockProcess('linux', 'arm64');
    mockBinaryPath('/path/to');
    getBinaryPath(pkgJSONPath, generateAppBuildInfo(false, true), '29.3.1', currentProcess);

    expect(BuilderBinaryPathGenerator).toHaveBeenCalledTimes(1);
  });
});
