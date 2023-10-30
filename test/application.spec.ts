import path from 'node:path';

import { describe, it, expect } from 'vitest';

import { getBinaryPath } from '../src/application';

describe('getBinaryPath', () => {
  const pkgJSONPath = '/foo/bar/package.json';
  const winProcess = {
    arch: 'x64',
    platform: 'win32',
  } as NodeJS.Process;
  const macProcess = {
    arch: 'arm64',
    platform: 'darwin',
  } as NodeJS.Process;
  const linuxProcess = {
    arch: 'arm',
    platform: 'linux',
  } as NodeJS.Process;

  it('should return app path for Electron Forge setups', async () => {
    expect(
      await getBinaryPath(
        pkgJSONPath,
        'my-app',
        {
          config: 'path/to/forge-config.js',
          isForge: true,
          isBuilder: false,
        },
        winProcess,
      ),
    ).toBe(path.join('/foo', 'bar', 'out', 'my-app-win32-x64', 'my-app.exe'));
    expect(
      await getBinaryPath(
        pkgJSONPath,
        'my-app',
        {
          config: 'path/to/forge-config.js',
          isForge: true,
          isBuilder: false,
        },
        macProcess,
      ),
    ).toBe(path.join('/foo', 'bar', 'out', 'my-app-darwin-arm64', 'my-app.app', 'Contents', 'MacOS', 'my-app'));
    expect(
      await getBinaryPath(
        pkgJSONPath,
        'my-app',
        {
          config: 'path/to/forge-config.js',
          isForge: true,
          isBuilder: false,
        },
        linuxProcess,
      ),
    ).toBe(path.join('/foo', 'bar', 'out', 'my-app-linux-arm', 'my-app'));
  });

  it('should return app path for Electron Builder setups', async () => {
    expect(
      await getBinaryPath(
        pkgJSONPath,
        'my-app',
        {
          config: {
            productName: 'my-app',
          },
          isForge: false,
          isBuilder: true,
        },
        winProcess,
      ),
    ).toBe(path.join('/foo', 'bar', 'dist', 'win-unpacked', 'my-app.exe'));
    expect(
      await getBinaryPath(
        pkgJSONPath,
        'my-app',
        {
          config: {
            productName: 'my-app',
          },
          isForge: false,
          isBuilder: true,
        },
        macProcess,
      ),
    ).toBe(path.join('/foo', 'bar', 'dist', 'mac-arm64', 'my-app.app', 'Contents', 'MacOS', 'my-app'));
    expect(
      await getBinaryPath(
        pkgJSONPath,
        'my-app',
        {
          config: {
            productName: 'my-app',
          },
          isForge: false,
          isBuilder: true,
        },
        linuxProcess,
      ),
    ).toBe(path.join('/foo', 'bar', 'dist', 'linux-unpacked', 'my-app'));
  });
});
