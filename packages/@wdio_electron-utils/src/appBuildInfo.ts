import type { AppBuildInfo } from '@wdio/electron-types';
import type { NormalizedReadResult } from 'read-package-up';
import { getConfig as getBuilderConfig } from './config/builder.js';
import { getConfig as getForgeConfig } from './config/forge.js';
import {
  BUILD_TOOL_DETECTION_ERROR,
  BUILDER_CONFIG_NOT_FOUND_ERROR,
  FORGE_CONFIG_NOT_FOUND_ERROR,
  MULTIPLE_BUILD_TOOL_WARNING,
} from './constants.js';
import { createLogger } from './log.js';

const log = createLogger('config');

/**
 * Determine build information about the Electron application
 * @param pkg normalized package.json
 * @returns   promise resolving to the app build information
 */
export async function getAppBuildInfo(pkg: NormalizedReadResult): Promise<AppBuildInfo> {
  const forgeDependencyDetected = Object.keys(pkg.packageJson.devDependencies || {}).includes('@electron-forge/cli');
  const builderDependencyDetected = Object.keys(pkg.packageJson.devDependencies || {}).includes('electron-builder');

  const forgeConfig = forgeDependencyDetected ? await getForgeConfig(pkg) : undefined;
  const builderConfig = builderDependencyDetected ? await getBuilderConfig(pkg) : undefined;

  const isForge = typeof forgeConfig !== 'undefined';
  const isBuilder = typeof builderConfig !== 'undefined';

  if (forgeDependencyDetected && !isForge && !isBuilder) {
    throw new Error(FORGE_CONFIG_NOT_FOUND_ERROR);
  }

  if (builderDependencyDetected && !isForge && !isBuilder) {
    throw new Error(BUILDER_CONFIG_NOT_FOUND_ERROR);
  }
  if (isForge && isBuilder) {
    log.warn(MULTIPLE_BUILD_TOOL_WARNING.DESCRIPTION);
    log.warn(MULTIPLE_BUILD_TOOL_WARNING.SUGGESTION);
  }

  if (isForge) {
    log.info('Using Forge configuration to get app build information...');
    return forgeConfig;
  }

  if (isBuilder) {
    log.info('Using Builder configuration to get app build information...');
    return builderConfig;
  }

  throw new Error(BUILD_TOOL_DETECTION_ERROR);
}
