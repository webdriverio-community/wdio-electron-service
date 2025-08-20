import path from 'node:path';
import type { ForgeBuildInfo, ForgeConfig } from '@wdio/electron-types';
import type { NormalizedReadResult } from 'read-package-up';
import { APP_NAME_DETECTION_ERROR } from '../constants.js';
import { createLogger } from '../log.js';
import { readConfig } from './read.js';

const log = createLogger('config');

function forgeBuildInfo(forgeConfig: ForgeConfig, pkg: NormalizedReadResult): ForgeBuildInfo {
  log.debug(`Forge configuration detected: \n${JSON.stringify(forgeConfig)}`);
  const appName: string = pkg.packageJson.productName || forgeConfig?.packagerConfig?.name || pkg.packageJson.name;

  if (!appName) {
    throw new Error(APP_NAME_DETECTION_ERROR);
  }

  return {
    appName,
    config: forgeConfig,
    isForge: true,
    isBuilder: false,
  };
}

export async function getConfig(pkg: NormalizedReadResult): Promise<ForgeBuildInfo | undefined> {
  const forgePackageJsonConfig = pkg.packageJson.config?.forge;
  // if config.forge is a string it is a custom config file path
  const isConfigFilePath = typeof forgePackageJsonConfig === 'string';

  const rootDir = path.dirname(pkg.path);

  let forgeConfig = forgePackageJsonConfig as ForgeConfig;

  if (!forgePackageJsonConfig || isConfigFilePath) {
    // if no forge config or a linked file is found in the package.json, attempt to read Forge JS-based config
    const forgeConfigFileName = isConfigFilePath ? forgePackageJsonConfig : 'forge.config.js';
    const forgeConfigPath = path.join(rootDir, forgeConfigFileName);
    try {
      log.debug(`Reading Forge config file: ${forgeConfigPath}...`);
      forgeConfig = (await readConfig(forgeConfigFileName, rootDir)).result as ForgeConfig;
    } catch (_) {
      log.debug(`Forge config file not found or invalid at ${forgeConfigPath}.`);
      return undefined;
    }
  }
  return forgeBuildInfo(forgeConfig, pkg);
}
