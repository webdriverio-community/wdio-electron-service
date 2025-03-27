import path from 'node:path';
import fs from 'node:fs/promises';

import log from './log';

import type { AppBuildInfo, BuilderArch, BuilderConfig, ForgeConfig, ForgeArch } from '@wdio/electron-types';

const SupportedPlatform = {
  darwin: 'darwin',
  linux: 'linux',
  win32: 'win32',
};

import { allOfficialArchsForPlatformAndVersion } from '@electron/packager';
/**
 * Determine the path to the Electron application binary
 * @param packageJsonPath path to the nearest package.json
 * @param appBuildInfo build information about the Electron application
 * @param electronVersion version of Electron to use
 * @param p   process object (used for testing purposes)
 * @returns   path to the Electron app binary
 */
export async function getBinaryPath(
  packageJsonPath: string,
  appBuildInfo: AppBuildInfo,
  electronVersion?: string,
  p = process,
) {
  if (!Object.values(SupportedPlatform).includes(p.platform)) {
    throw new Error(`Unsupported platform: ${p.platform}`);
  }

  let outDirs: string[];

  if (appBuildInfo.isForge) {
    // Forge case
    const archs = allOfficialArchsForPlatformAndVersion(
      p.platform as keyof typeof SupportedPlatform,
      electronVersion,
    ) as ForgeArch[];

    const forgeOutDir = (appBuildInfo.config as ForgeConfig)?.outDir || 'out';
    outDirs = archs.map((arch) =>
      path.join(path.dirname(packageJsonPath), forgeOutDir, `${appBuildInfo.appName}-${p.platform}-${arch}`),
    );
  } else {
    // electron-builder case
    const builderOutDirName = (appBuildInfo.config as BuilderConfig)?.directories?.output || 'dist';
    const builderOutDirMap = (arch: BuilderArch) => ({
      darwin: path.join(builderOutDirName, arch === 'x64' ? 'mac' : `mac-${arch}`),
      linux: path.join(builderOutDirName, 'linux-unpacked'),
      win32: path.join(builderOutDirName, 'win-unpacked'),
    });

    if (p.platform === 'darwin') {
      // macOS output dir depends on the arch used
      // - we check all of the possible dirs
      const archs: BuilderArch[] = ['arm64', 'armv7l', 'ia32', 'universal', 'x64'];
      outDirs = archs.map((arch) =>
        path.join(path.dirname(packageJsonPath), builderOutDirMap(arch)[p.platform as keyof typeof SupportedPlatform]),
      );
    } else {
      // other platforms have a single output dir which is not dependent on the arch
      outDirs = [
        path.join(path.dirname(packageJsonPath), builderOutDirMap('x64')[p.platform as keyof typeof SupportedPlatform]),
      ];
    }
  }

  const executableName =
    (appBuildInfo.isForge && appBuildInfo.config.packagerConfig?.executableName) || appBuildInfo.appName;
  const binaryPathMap = {
    darwin: () => path.join(`${appBuildInfo.appName}.app`, 'Contents', 'MacOS', executableName),
    linux: () => executableName,
    win32: () => `${executableName}.exe`,
  };
  const electronBinaryPath = binaryPathMap[p.platform as keyof typeof SupportedPlatform]();

  const binaryPaths = outDirs.map((outDir) => path.join(outDir, electronBinaryPath));

  // for each path, check if it exists and is executable
  const binaryPathsAccessResults = await Promise.all(
    binaryPaths.map(async (binaryPath) => {
      try {
        log.debug(`Checking binary path: ${binaryPath}...`);
        await fs.access(binaryPath, fs.constants.X_OK);
        log.debug(`'${binaryPath}' is executable.`);
        return true;
      } catch (e) {
        log.debug(`'${binaryPath}' is not executable.`, (e as Error).message);
        return false;
      }
    }),
  );

  // get the list of executable paths
  const executableBinaryPaths = binaryPaths.filter((_binaryPath, index) => binaryPathsAccessResults[index]);

  // no executable binary case
  if (executableBinaryPaths.length === 0) {
    throw new Error(`No executable binary found, checked: \n${binaryPaths.join(', \n')}`);
  }

  // multiple executable binaries case
  if (executableBinaryPaths.length > 1) {
    log.info(`Detected multiple app binaries, using the first one: \n${executableBinaryPaths.join(', \n')}`);
  }

  return executableBinaryPaths[0];
}
