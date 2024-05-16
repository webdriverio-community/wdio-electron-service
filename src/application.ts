import fs from 'node:fs/promises';
import path from 'node:path';

import type { NormalizedReadResult } from 'read-package-up';

import log from './log.js';
import { APP_NAME_DETECTION_ERROR, BUILD_TOOL_DETECTION_ERROR, MULTIPLE_BUILD_TOOLS_ERROR } from './constants.js';
import type {
  AppBuildInfo,
  ElectronBuilderArch,
  ElectronBuilderConfig,
  ElectronForgeConfig,
  ForgeArch,
} from './types.js';
import { allOfficialArchsForPlatformAndVersion } from '@electron/packager';

const SupportedPlatform = {
  darwin: 'darwin',
  linux: 'linux',
  win32: 'win32',
};

/**
 * Determine the path to the Electron application binary
 * @param packageJsonPath path to the nearest package.json
 * @param appName name of the application
 * @param buildToolConfig configuration for the detected build tool
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

    // Electron Forge always bundles into an `out` directory - see comment in getAppBuildInfo below
    outDirs = archs.map((arch) =>
      path.join(path.dirname(packageJsonPath), 'out', `${appBuildInfo.appName}-${p.platform}-${arch}`),
    );
  } else {
    // electron-builder case
    const archs: ElectronBuilderArch[] = ['arm64', 'armv7l', 'ia32', 'universal', 'x64'];
    const builderOutDirName = (appBuildInfo.config as ElectronBuilderConfig)?.directories?.output || 'dist';
    const builderOutDirMap = (arch: ElectronBuilderArch) => ({
      darwin: path.join(builderOutDirName, arch === 'x64' ? 'mac' : `mac-${p.arch}`),
      linux: path.join(builderOutDirName, 'linux-unpacked'),
      win32: path.join(builderOutDirName, 'win-unpacked'),
    });

    outDirs = archs.map((arch) =>
      path.join(path.dirname(packageJsonPath), builderOutDirMap(arch)[p.platform as keyof typeof SupportedPlatform]),
    );
  }

  const binaryPathMap = {
    darwin: path.join(`${appBuildInfo.appName}.app`, 'Contents', 'MacOS', appBuildInfo.appName),
    linux: appBuildInfo.appName,
    win32: `${appBuildInfo.appName}.exe`,
  };
  const electronBinaryPath = binaryPathMap[p.platform as keyof typeof SupportedPlatform];

  const binaryPaths = outDirs.map((outDir) => path.join(outDir, electronBinaryPath));

  // for each path, check if it exists and is executable
  const executableBinaryPaths = binaryPaths.filter(async (binaryPath) => {
    try {
      await fs.access(binaryPath, fs.constants.X_OK);
      return true;
    } catch (e) {
      log.debug(e);
      return false;
    }
  });

  // no binary case
  if (executableBinaryPaths.length === 0) {
    throw new Error(`No executable binary found, checked [${binaryPaths.join(', ')}]`);
  }

  // multiple binaries case
  if (executableBinaryPaths.length > 1) {
    log.debug(`Detected multiple app binaries, using the first one: ${executableBinaryPaths[0]}`);
  }

  return executableBinaryPaths[0];
}

/**
 * Determine build information about the Electron application
 * @param pkg path to the nearest package.json
 * @returns   promise resolving to the app build information
 */
export async function getAppBuildInfo(pkg: NormalizedReadResult): Promise<AppBuildInfo> {
  const forgeDependencyDetected = Object.keys(pkg.packageJson.devDependencies || {}).includes('@electron-forge/cli');
  const builderDependencyDetected = Object.keys(pkg.packageJson.devDependencies || {}).includes('electron-builder');

  // Forge configuration is not currently used to determine the Electron app binary path
  // - when custom output directories are supported in Forge we can use this config value for path determination
  // - see https://github.com/electron/forge/pull/2714
  const forgePackageJsonConfig = pkg.packageJson.config?.forge;
  const forgeCustomConfigFile = typeof forgePackageJsonConfig === 'string';
  const forgeConfigPath = forgeCustomConfigFile ? forgePackageJsonConfig : 'forge.config.js';
  const rootDir = path.dirname(pkg.path);
  let forgeConfig = forgePackageJsonConfig as ElectronForgeConfig;
  let builderConfig: ElectronBuilderConfig = pkg.packageJson.build;

  if (!forgePackageJsonConfig || forgeCustomConfigFile) {
    // if no config or a linked file, attempt to read Forge JS-based config
    try {
      log.debug(`Reading Forge config file: ${forgeConfigPath}...`);
      forgeConfig = ((await import(path.join(rootDir, forgeConfigPath))) as { default: ElectronForgeConfig }).default;
    } catch (e) {
      log.debug(e);
    }
  }

  const isForge = Boolean(forgeConfig || forgeDependencyDetected);

  if (!isForge) {
    // if no Forge config or dependency, attempt to read `electron-builder.json`
    try {
      log.debug('Forge not detected, reading `electron-builder.json`...');
      const data = await fs.readFile(path.join(rootDir, 'electron-builder.json'), 'utf-8');
      builderConfig = JSON.parse(data);
    } catch (e) {
      log.debug(e);
    }
  }

  const isBuilder = Boolean(builderConfig || builderDependencyDetected);

  if (isForge && isBuilder) {
    throw new Error(MULTIPLE_BUILD_TOOLS_ERROR);
  }
  if (!isForge && !isBuilder) {
    throw new Error(BUILD_TOOL_DETECTION_ERROR);
  }

  const config = isForge ? forgeConfig : builderConfig;
  log.debug(`${isForge ? 'Forge' : 'Builder'} configuration detected: ${config}`);

  const appName: string =
    pkg.packageJson.productName ||
    (isBuilder && (config as ElectronBuilderConfig)?.productName) ||
    (isForge && (config as ElectronForgeConfig)?.packagerConfig?.name) ||
    pkg.packageJson.name;

  if (!appName) {
    throw new Error(APP_NAME_DETECTION_ERROR);
  }

  return {
    appName,
    config,
    isForge,
    isBuilder,
  };
}
