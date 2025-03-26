import path from 'node:path';

import { ABinaryPathGenerator } from '../binary/binary';

import type { BuilderBuildInfo, BuilderArch } from '@wdio/electron-types';
import type { BuilderBinaryOptions, CommonBinaryOptions } from '../types';

export class BuilderBinaryPathGenerator extends ABinaryPathGenerator {
  appBuildInfo: BuilderBuildInfo;
  constructor(options: BuilderBinaryOptions) {
    super(options);
    this.appBuildInfo = options.appBuildInfo;
  }

  getBinaryName(): string {
    return this.appBuildInfo.appName;
  }
  getOutDir() {
    const builderOutDirName = this.appBuildInfo.config?.directories?.output || 'dist';
    const builderOutDirMap = (arch: BuilderArch) => ({
      darwin: path.join(builderOutDirName, arch === 'x64' ? 'mac' : `mac-${arch}`),
      linux: path.join(builderOutDirName, 'linux-unpacked'),
      win32: path.join(builderOutDirName, 'win-unpacked'),
    });

    if (this.platform === 'darwin') {
      // macOS output dir depends on the arch used
      // - we check all of the possible dirs
      const archs: BuilderArch[] = ['arm64', 'armv7l', 'ia32', 'universal', 'x64'];
      return archs.map((arch) => path.join(this.projectDir, builderOutDirMap(arch)[this.platform]));
    } else {
      // other platforms have a single output dir which is not dependent on the arch
      return [path.join(this.projectDir, builderOutDirMap('x64')[this.platform])];
    }
  }
}

export function isBuilderInfo(info: CommonBinaryOptions): info is BuilderBinaryOptions {
  return info.appBuildInfo.isBuilder;
}
