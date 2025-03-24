import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { type NormalizedReadResult } from 'read-package-up';

import log from './log.js';
import { BUILD_TOOL_DETECTION_ERROR } from './constants.js';
import { getConfig, getBuilderConfigCandidates, builderBuildInfo } from './config/builder';
import { forgeBuildInfo } from './config/forge';

import type { AppBuildInfo, BuilderConfig, ForgeConfig } from '@wdio/electron-types';

/**
 * Determine build information about the Electron application
 * @param pkg normalized package.json
 * @returns   promise resolving to the app build information
 */
export async function getAppBuildInfo(pkg: NormalizedReadResult): Promise<AppBuildInfo> {
  const forgeDependencyDetected = Object.keys(pkg.packageJson.devDependencies || {}).includes('@electron-forge/cli');
  const builderDependencyDetected = Object.keys(pkg.packageJson.devDependencies || {}).includes('electron-builder');
  const forgePackageJsonConfig = pkg.packageJson.config?.forge;
  const forgeCustomConfigFile = typeof forgePackageJsonConfig === 'string';
  const forgeConfigFile = forgeCustomConfigFile ? forgePackageJsonConfig : 'forge.config.js';
  const rootDir = path.dirname(pkg.path);
  let forgeConfig = forgePackageJsonConfig as ForgeConfig;
  let builderConfig: BuilderConfig = pkg.packageJson.build;

  if (forgeDependencyDetected && (!forgePackageJsonConfig || forgeCustomConfigFile)) {
    // if no forge config or a linked file is found in the package.json, attempt to read Forge JS-based config
    let forgeConfigPath;

    try {
      forgeConfigPath = path.join(rootDir, forgeConfigFile);
      log.info(`Reading Forge config file: ${forgeConfigPath}...`);
      forgeConfig = ((await import(pathToFileURL(forgeConfigPath).toString())) as { default: ForgeConfig }).default;
    } catch (_e) {
      log.warn('Forge config file not found or invalid.');

      // only throw if there is no builder config
      if (!builderConfig) {
        throw new Error(`Forge was detected but no configuration was found at '${forgeConfigPath}'.`);
      }
    }
  }

  if (builderDependencyDetected && !builderConfig) {
    // if builder config is not found in the package.json, attempt to read `electron-builder.{yaml, yml, json, json5, toml}`
    // see also https://www.electron.build/configuration.html
    try {
      log.info('Locating builder config file...');
      const config = await getConfig(getBuilderConfigCandidates(), rootDir);

      if (!config) {
        throw new Error();
      }

      log.info(`Detected config file: ${config.configFile}`);
      builderConfig = config.result as BuilderConfig;
    } catch (_e) {
      log.warn('Builder config file not found or invalid.');

      // only throw if there is no forge config
      if (!forgeConfig) {
        throw new Error(
          'Electron-builder was detected but no configuration was found, make sure your config file is named correctly, e.g. `electron-builder.config.json`.',
        );
      }
    }
  }

  const isForge = Boolean(forgeConfig);
  const isBuilder = Boolean(builderConfig);

  if (isForge && isBuilder) {
    log.warn(
      'Detected both Forge and Builder configurations, the Forge configuration will be used to determine build information',
    );
    log.warn('You can override this by specifying the `appBinaryPath` option in your capabilities.');
  }

  if (isForge) {
    log.info('Using Forge configuration to get app build information...');
    return forgeBuildInfo(forgeConfig, pkg);
  }

  if (isBuilder) {
    log.info('Using Builder configuration to get app build information...');
    return builderBuildInfo(builderConfig, pkg);
  }

  throw new Error(BUILD_TOOL_DETECTION_ERROR);
}
