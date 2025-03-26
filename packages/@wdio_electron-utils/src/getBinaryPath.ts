import { SUPPORTED_PLATFORM } from './constants';
import { ExecutableBinaryPath } from './binary/binary';
import { ForgeBinaryPathGenerator, isForgeInfo } from './binary/forge';
import { BuilderBinaryPathGenerator, isBuilderInfo } from './binary/builder';

import type { AppBuildInfo } from '@wdio/electron-types';
import type { CommonBinaryOptions, IBinaryPathGenerator, SupportedPlatform } from './types';

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
  if (!isSupportedPlatform(p.platform)) {
    throw new Error(`Unsupported platform: ${p.platform}`);
  }

  const pathDefiner = getPathDefiner({
    platform: p.platform,
    packageJsonPath,
    electronVersion,
    appBuildInfo,
  });

  const executablePath = new ExecutableBinaryPath(pathDefiner);

  return executablePath.get();
}

function getPathDefiner(options: CommonBinaryOptions): IBinaryPathGenerator {
  if (isForgeInfo(options)) {
    return new ForgeBinaryPathGenerator(options);
  }
  if (isBuilderInfo(options)) {
    return new BuilderBinaryPathGenerator(options);
  }
  throw new Error('Configurations that are neither Forge nor Builder are not supported.');
}

function isSupportedPlatform(p: NodeJS.Platform): p is SupportedPlatform {
  return p in SUPPORTED_PLATFORM;
}
