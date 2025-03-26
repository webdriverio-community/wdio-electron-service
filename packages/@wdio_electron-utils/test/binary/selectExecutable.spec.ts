import { normalize } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { mockBinaryPath } from '../testUtils';
import log from '../../src/log';
import { selectExecutable } from '../../src/binary/selectExecutable';

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
  it('should select first app binary when multiple app one was detected', async () => {
    const executableBinaryPaths = [
      '/path/to/dist/mac-arm64/my-app.app/Contents/MacOS/my-app',
      '/path/to/dist/mac-ia32/my-app.app/Contents/MacOS/my-app',
    ];
    mockBinaryPath(executableBinaryPaths);

    const result = await selectExecutable(executableBinaryPaths);

    expect(result).toBe(normalize('/path/to/dist/mac-arm64/my-app.app/Contents/MacOS/my-app'));
    expect(log.info).toHaveBeenLastCalledWith(
      expect.stringMatching(/Detected multiple app binaries, using the first one:/),
    );
  });

  it('should throw an error when no executable binary found', async () => {
    const binaryMock = {
      binary: {
        platform: 'linux',
        appName: 'my-app',
      },
    };
    mockBinaryPath('/path/to/dummy');

    await expect(() => selectExecutable.call(binaryMock, ['/path/to/dist'], 'my-app')).rejects.toThrowError(
      'No executable binary found, checked:',
    );
  });
});
