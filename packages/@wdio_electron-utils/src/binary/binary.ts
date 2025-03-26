import path from 'node:path';
import { selectExecutablePath } from './selectExecutablePath';

import type { CommonBinaryOptions, IBinaryPathGenerator, IExecutablePath, SupportedPlatform } from '../types.js';

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
    const executableName = this.selectExecutablePathName();
    const binaryPathMap = {
      darwin: () => path.join(`${this.appName}.app`, 'Contents', 'MacOS', executableName),
      linux: () => executableName,
      win32: () => `${executableName}.exe`,
    };
    const electronBinaryPath = binaryPathMap[this.platform]();

    const binaryPaths = outDirs.map((outDir) => path.join(outDir, electronBinaryPath));
    return binaryPaths;
  }
  protected abstract getOutDir(): string[];
  protected abstract selectExecutablePathName(): string;
}

export class ExecutablePath implements IExecutablePath {
  binary: IBinaryPathGenerator;

  constructor(binary: IBinaryPathGenerator) {
    this.binary = binary;
  }

  async get(): Promise<string> {
    const executables = this.binary.generate();
    return selectExecutablePath(executables);
  }
}
