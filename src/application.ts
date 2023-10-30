import fs from 'node:fs/promises';
import path from 'node:path';

import type { NormalizedReadResult } from 'read-pkg-up';

import log from './log.js';
import { BUILD_TOOL_DETECTION_ERROR, MULTIPLE_BUILD_TOOLS_ERROR } from './constants.js';
import type { BuildTool, ElectronBuilderConfig, ElectronForgeConfig } from './types.js';

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
export async function getBinaryPath(packageJsonPath: string, appName: string, buildTool: BuildTool, p = process) {
  if (!Object.values(SupportedPlatform).includes(p.platform)) {
    throw new Error(`Unsupported platform: ${p.platform}`);
  }

  let outDir;

  if (buildTool.isForge) {
    // Electron Forge always bundles into an `out` directory - see comment in getBuildToolConfig below
    outDir = path.join(path.dirname(packageJsonPath), 'out', `${appName}-${p.platform}-${p.arch}`);
  } else {
    const builderOutDirName = (buildTool.config as ElectronBuilderConfig)?.directories?.output || 'dist';
    const builderOutDirMap = {
      darwin: path.join(builderOutDirName, p.arch === 'arm64' ? 'mac-arm64' : 'mac'),
      linux: path.join(builderOutDirName, 'linux-unpacked'),
      win32: path.join(builderOutDirName, 'win-unpacked'),
    };
    outDir = path.join(path.dirname(packageJsonPath), builderOutDirMap[p.platform as keyof typeof SupportedPlatform]);
  }

  const binaryPathMap = {
    darwin: path.join(`${appName}.app`, 'Contents', 'MacOS', appName),
    linux: appName,
    win32: `${appName}.exe`,
  };
  const electronBinaryPath = binaryPathMap[p.platform as keyof typeof SupportedPlatform];

  return path.join(outDir, electronBinaryPath);
}

/**
 * Determine the configuration used to build the Electron application
 * @param pkg path to the nearest package.json
 * @returns   promise resolving to the build tool configuration
 */
export async function getBuildToolConfig(pkg: NormalizedReadResult): Promise<BuildTool> {
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

  return {
    config,
    isForge,
    isBuilder,
  };
}
