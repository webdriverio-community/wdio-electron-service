import path from 'node:path';
import { selectExecutable } from './select';

import type { CommonBinaryOptions, IBinaryPathGenerator, IExecutableBinaryPath, SupportedPlatform } from '../types.js';

export abstract class ABinaryPathGenerator implements IBinaryPathGenerator {
  platform: SupportedPlatform;
  electronVersion?: string;
  projectDir: string;
  appName: string;

  constructor(options: CommonBinaryOptions) {
    this.platform = options.platform;
    this.electronVersion = options.electronVersion;
    this.projectDir = path.dirname(options.packageJsonPath);
    this.appName = options.appBuildInfo.appName;
  }
  generate(): string[] {
    const outDirs = this.getOutDir();
    const binaryName = this.getBinaryName();
    const binaryPathMap = {
      darwin: () => path.join(`${this.appName}.app`, 'Contents', 'MacOS', binaryName),
      linux: () => binaryName,
      win32: () => `${binaryName}.exe`,
    };
    const electronBinaryPath = binaryPathMap[this.platform]();

    const binaryPaths = outDirs.map((outDir) => path.join(outDir, electronBinaryPath));
    return binaryPaths;
  }
  protected abstract getOutDir(): string[];
  protected abstract getBinaryName(): string;
}

export class ExecutableBinaryPath implements IExecutableBinaryPath {
  binaryPathGenerator: IBinaryPathGenerator;

  constructor(binaryPathGenerator: IBinaryPathGenerator) {
    this.binaryPathGenerator = binaryPathGenerator;
  }

  async get(): Promise<string> {
    const binaryPaths = this.binaryPathGenerator.generate();
    return selectExecutable(binaryPaths);
  }
}
