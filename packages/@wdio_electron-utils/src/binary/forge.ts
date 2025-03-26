import path from 'node:path';
import { allOfficialArchsForPlatformAndVersion } from '@electron/packager';

import { ABinaryPathGenerator } from '../binary/binary';

import type { ForgeBuildInfo, ForgeArch } from '@wdio/electron-types';
import type { CommonBinaryOptions, ForgeBinaryOptions } from '../types';

export class ForgeBinaryPathGenerator extends ABinaryPathGenerator {
  appBuildInfo: ForgeBuildInfo;
  constructor(options: ForgeBinaryOptions) {
    super(options);
    this.appBuildInfo = options.appBuildInfo as ForgeBuildInfo;
  }

  selectExecutablePathName(): string {
    return this.appBuildInfo.config.packagerConfig?.executableName || this.appBuildInfo.appName;
  }

  getOutDir() {
    const archs = allOfficialArchsForPlatformAndVersion(this.platform, this.electronVersion) as ForgeArch[];

    const forgeOutDir = this.appBuildInfo.config?.outDir || 'out';
    return archs.map((arch) =>
      path.join(this.projectDir, forgeOutDir, `${this.appBuildInfo.appName}-${this.platform}-${arch}`),
    );
  }
}

export function isForgeInfo(info: CommonBinaryOptions): info is ForgeBinaryOptions {
  return info.appBuildInfo.isForge;
}
