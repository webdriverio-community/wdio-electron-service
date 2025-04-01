import path from 'node:path';
import { allOfficialArchsForPlatformAndVersion } from '@electron/packager';
import { SUPPORTED_PLATFORM, SUPPORTED_BUILD_TOOL } from './constants.js';
import { selectExecutable } from './selectExecutable.js';

import type { AppBuildInfo, ForgeBuildInfo, BuilderBuildInfo, BuilderArch } from '@wdio/electron-types';

type SupportedPlatform = keyof typeof SUPPORTED_PLATFORM;
type SupportedBuildTool = keyof typeof SUPPORTED_BUILD_TOOL;

interface BinaryOptions {
  buildTool: SupportedBuildTool;
  platform: SupportedPlatform;
  appName: string;
  config: ForgeBuildInfo['config'] | BuilderBuildInfo['config'];
  electronVersion?: string;
  projectDir: string;
}

function getForgeDistDir(
  config: ForgeBuildInfo['config'],
  appName: string,
  platform: SupportedPlatform,
  electronVersion?: string,
): string[] {
  const archs = allOfficialArchsForPlatformAndVersion(platform, electronVersion);
  const forgeOutDir = config?.outDir || 'out';
  return archs.map((arch: string) => path.join(forgeOutDir, `${appName}-${platform}-${arch}`));
}

function getBuilderDistDir(config: BuilderBuildInfo['config'], platform: SupportedPlatform): string[] {
  const builderOutDirName = config?.directories?.output || 'dist';
  const builderOutDirMap = (arch: BuilderArch) => ({
    darwin: path.join(builderOutDirName, arch === 'x64' ? 'mac' : `mac-${arch}`),
    linux: path.join(builderOutDirName, 'linux-unpacked'),
    win32: path.join(builderOutDirName, 'win-unpacked'),
  });
  // return [builderOutDirMap[platform]];
  if (platform === 'darwin') {
    // macOS output dir depends on the arch used
    // - we check all of the possible dirs
    const archs: BuilderArch[] = ['arm64', 'armv7l', 'ia32', 'universal', 'x64'];
    return archs.map((arch) => builderOutDirMap(arch)[platform]);
  } else {
    // other platforms have a single output dir which is not dependent on the arch
    return [builderOutDirMap('x64')[platform]];
  }
}

function getPlatformBinaryPath(outDir: string, binaryName: string, platform: SupportedPlatform): string {
  const binaryPathMap = {
    darwin: () => path.join(`${binaryName}.app`, 'Contents', 'MacOS', binaryName),
    linux: () => binaryName,
    win32: () => `${binaryName}.exe`,
  };
  return path.join(outDir, binaryPathMap[platform]());
}

function getBinaryName(options: BinaryOptions): string {
  const { buildTool, appName, config } = options;
  if (buildTool === SUPPORTED_BUILD_TOOL.forge) {
    return (config as ForgeBuildInfo['config']).packagerConfig?.executableName || appName;
  }
  return appName;
}

function getOutDir(options: BinaryOptions): string[] {
  const { buildTool, config, appName, platform, electronVersion, projectDir } = options;

  const outDirs =
    buildTool === SUPPORTED_BUILD_TOOL.forge
      ? getForgeDistDir(config as ForgeBuildInfo['config'], appName, platform, electronVersion)
      : getBuilderDistDir(config as BuilderBuildInfo['config'], platform);

  return outDirs.map((dir) => path.join(projectDir, dir));
}

/**
 * Determine the path to the Electron application binary
 * @param packageJsonPath path to the nearest package.json
 * @param appBuildInfo build information about the Electron application
 * @param electronVersion version of Electron to use
 * @param p process object (used for testing purposes)
 * @returns path to the Electron app binary
 */
export async function getBinaryPath(
  packageJsonPath: string,
  appBuildInfo: AppBuildInfo,
  electronVersion?: string,
  p = process,
) {
  if (!isSupportedPlatform(p.platform)) {
    throw new Error(`Unsupported platform: ${p.platform}`);
  }
  if (!appBuildInfo.isForge && !appBuildInfo.isBuilder) {
    throw new Error('Configurations that are neither Forge nor Builder are not supported.');
  }

  const options: BinaryOptions = {
    buildTool: appBuildInfo.isForge ? SUPPORTED_BUILD_TOOL.forge : SUPPORTED_BUILD_TOOL.builder,
    platform: p.platform,
    appName: appBuildInfo.appName,
    config: appBuildInfo.config,
    electronVersion,
    projectDir: path.dirname(packageJsonPath),
  };

  const outDirs = getOutDir(options);
  const binaryName = getBinaryName(options);
  const binaryPaths = outDirs.map((dir) => getPlatformBinaryPath(dir, binaryName, options.platform));

  return selectExecutable(binaryPaths);
}

function isSupportedPlatform(p: NodeJS.Platform): p is SupportedPlatform {
  return p in SUPPORTED_PLATFORM;
}
