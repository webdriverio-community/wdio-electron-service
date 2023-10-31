import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, it, expect } from 'vitest';

import { getBinaryPath, getAppBuildInfo } from '../src/application';

describe('getBinaryPath', () => {
  const pkgJSONPath = '/foo/bar/package.json';
  const winProcess = { arch: 'x64', platform: 'win32' } as NodeJS.Process;
  const macProcess = { arch: 'arm64', platform: 'darwin' } as NodeJS.Process;
  const linuxProcess = { arch: 'arm', platform: 'linux' } as NodeJS.Process;
  const unsupportedPlatformProcess = { platform: 'aix', arch: 'mips' } as NodeJS.Process;

  it('should throw an error when provided with an unsupported platform', async () =>
    expect(() =>
      getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: 'path/to/forge-config.js',
          isForge: true,
          isBuilder: false,
        },
        unsupportedPlatformProcess,
      ),
    ).rejects.toThrow('Unsupported platform: aix'));

  it('should return the expected app path for an Electron Forge setup on Windows', async () =>
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: 'path/to/forge-config.js',
          isForge: true,
          isBuilder: false,
        },
        winProcess,
      ),
    ).toBe(path.join('/foo', 'bar', 'out', 'my-app-win32-x64', 'my-app.exe')));

  it('should return the expected app path for an Electron Forge setup on Mac', async () =>
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: 'path/to/forge-config.js',
          isForge: true,
          isBuilder: false,
        },
        macProcess,
      ),
    ).toBe(path.join('/foo', 'bar', 'out', 'my-app-darwin-arm64', 'my-app.app', 'Contents', 'MacOS', 'my-app')));

  it('should return the expected app path for an Electron Forge setup on Linux', async () =>
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: 'path/to/forge-config.js',
          isForge: true,
          isBuilder: false,
        },
        linuxProcess,
      ),
    ).toBe(path.join('/foo', 'bar', 'out', 'my-app-linux-arm', 'my-app')));

  it('should return the expected app path for an electron-builder setup with custom output directory', async () =>
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { productName: 'my-app', directories: { output: 'custom-outdir' } },
          isForge: false,
          isBuilder: true,
        },
        winProcess,
      ),
    ).toBe(path.join('/foo', 'bar', 'custom-outdir', 'win-unpacked', 'my-app.exe')));

  it('should return the expected app path for an electron-builder setup on Windows', async () =>
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { productName: 'my-app' },
          isForge: false,
          isBuilder: true,
        },
        winProcess,
      ),
    ).toBe(path.join('/foo', 'bar', 'dist', 'win-unpacked', 'my-app.exe')));

  it('should return the expected app path for an electron-builder setup on Mac', async () =>
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { productName: 'my-app' },
          isForge: false,
          isBuilder: true,
        },
        macProcess,
      ),
    ).toBe(path.join('/foo', 'bar', 'dist', 'mac-arm64', 'my-app.app', 'Contents', 'MacOS', 'my-app')));

  it('should return the expected app path for an electron-builder setup on Linux', async () =>
    expect(
      await getBinaryPath(
        pkgJSONPath,
        {
          appName: 'my-app',
          config: { productName: 'my-app' },
          isForge: false,
          isBuilder: true,
        },
        linuxProcess,
      ),
    ).toBe(path.join('/foo', 'bar', 'dist', 'linux-unpacked', 'my-app')));
});

describe('getBuildToolConfig', () => {
  it('should throw an error when no build tools are found', async () => {
    const packageJsonPath = path.join(__dirname, 'fixtures', 'no-build-tool', 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    await expect(() =>
      getAppBuildInfo({
        packageJson,
        path: packageJsonPath,
      }),
    ).rejects.toThrow(
      'No build tool was detected, if the application is compiled at a different location, please specify the `appBinaryPath` option in your capabilities.',
    );
  });

  it('should throw an error when configuration for multiple build tools are found', async () => {
    const packageJsonPath = path.join(__dirname, 'fixtures', 'multiple-build-tools-config', 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    await expect(() =>
      getAppBuildInfo({
        packageJson,
        path: packageJsonPath,
      }),
    ).rejects.toThrow(
      'Multiple build tools were detected, please remove configuration and dependencies for tools which are not being used to build your application.',
    );
  });

  it('should throw an error when dependencies for multiple build tools are found', async () => {
    const packageJsonPath = path.join(__dirname, 'fixtures', 'multiple-build-tools-dependencies', 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    await expect(() =>
      getAppBuildInfo({
        packageJson,
        path: packageJsonPath,
      }),
    ).rejects.toThrow(
      'Multiple build tools were detected, please remove configuration and dependencies for tools which are not being used to build your application.',
    );
  });

  it('should throw an error when configuration for electron-builder is found alongside an Electron Forge dependency', async () => {
    const packageJsonPath = path.join(__dirname, 'fixtures', 'multiple-build-tools-wrong-config-1', 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    await expect(() =>
      getAppBuildInfo({
        packageJson,
        path: packageJsonPath,
      }),
    ).rejects.toThrow(
      'Multiple build tools were detected, please remove configuration and dependencies for tools which are not being used to build your application.',
    );
  });

  it('should throw an error when configuration for Electron Forge is found alongside an electron-builder dependency', async () => {
    const packageJsonPath = path.join(__dirname, 'fixtures', 'multiple-build-tools-wrong-config-2', 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    await expect(() =>
      getAppBuildInfo({
        packageJson,
        path: packageJsonPath,
      }),
    ).rejects.toThrow(
      'Multiple build tools were detected, please remove configuration and dependencies for tools which are not being used to build your application.',
    );
  });

  it('should throw an error when the app name is unable to be determined', async () => {
    const packageJsonPath = path.join(__dirname, 'fixtures', 'forge-dependency-inline-config', 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    delete packageJson.name;
    delete packageJson.config.forge.packagerConfig;
    await expect(() =>
      getAppBuildInfo({
        packageJson,
        path: packageJsonPath,
      }),
    ).rejects.toThrow(
      'No application name was detected, please set name / productName in your package.json or build tool configuration.',
    );
  });

  it('should return the expected config for a Forge dependency with inline config', async () => {
    const packageJsonPath = path.join(__dirname, 'fixtures', 'forge-dependency-inline-config', 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    await expect(
      await getAppBuildInfo({
        packageJson,
        path: packageJsonPath,
      }),
    ).toStrictEqual({
      appName: 'forge-dependency-inline-config',
      config: { packagerConfig: { name: 'forge-dependency-inline-config' } },
      isBuilder: false,
      isForge: true,
    });
  });

  it('should return the expected config for a Forge dependency with JS config', async () => {
    const packageJsonPath = path.join(__dirname, 'fixtures', 'forge-dependency-js-config', 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    await expect(
      await getAppBuildInfo({
        packageJson,
        path: packageJsonPath,
      }),
    ).toStrictEqual({
      appName: 'forge-dependency-js-config',
      config: { packagerConfig: { name: 'forge-dependency-js-config' } },
      isBuilder: false,
      isForge: true,
    });
  });

  it('should return the expected config for a Forge dependency with linked JS config', async () => {
    const packageJsonPath = path.join(__dirname, 'fixtures', 'forge-dependency-linked-js-config', 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    await expect(
      await getAppBuildInfo({
        packageJson,
        path: packageJsonPath,
      }),
    ).toStrictEqual({
      appName: 'forge-dependency-linked-js-config',
      config: { packagerConfig: { name: 'forge-dependency-linked-js-config' } },
      isBuilder: false,
      isForge: true,
    });
  });

  it('should return the expected config for an electron-builder dependency with inline config', async () => {
    const packageJsonPath = path.join(__dirname, 'fixtures', 'builder-dependency-inline-config', 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    await expect(
      await getAppBuildInfo({
        packageJson,
        path: packageJsonPath,
      }),
    ).toStrictEqual({
      appName: 'builder-dependency-inline-config',
      config: { productName: 'builder-dependency-inline-config' },
      isBuilder: true,
      isForge: false,
    });
  });

  it('should return the expected config for an electron-builder dependency with JSON config', async () => {
    const packageJsonPath = path.join(__dirname, 'fixtures', 'builder-dependency-json-config', 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    await expect(
      await getAppBuildInfo({
        packageJson,
        path: packageJsonPath,
      }),
    ).toStrictEqual({
      appName: 'builder-dependency-json-config',
      config: { productName: 'builder-dependency-json-config' },
      isBuilder: true,
      isForge: false,
    });
  });

  it('should return the expected config when there is no app name in the build tool config', async () => {
    const packageJsonPath = path.join(__dirname, 'fixtures', 'no-app-name-in-build-tool-config', 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    await expect(
      await getAppBuildInfo({
        packageJson,
        path: packageJsonPath,
      }),
    ).toStrictEqual({
      appName: 'fixture-no-app-name-in-build-tool-config',
      config: { appId: 'no-app-name-in-build-tool-config' },
      isBuilder: true,
      isForge: false,
    });
  });
});
