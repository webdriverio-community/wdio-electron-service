import log from '../log.js';
import { APP_NAME_DETECTION_ERROR } from '../constants.js';

import type { NormalizedReadResult } from 'read-package-up';
import type { ForgeConfig, ForgeBuildInfo } from '@wdio/electron-types';

export const forgeBuildInfo = (forgeConfig: ForgeConfig, pkg: NormalizedReadResult): ForgeBuildInfo => {
  log.info(`Forge configuration detected: \n${JSON.stringify(forgeConfig)}`);
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
};
