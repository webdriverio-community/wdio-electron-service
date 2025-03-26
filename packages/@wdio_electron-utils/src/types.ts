import type { AppBuildInfo, BuilderBuildInfo, ForgeBuildInfo } from '@wdio/electron-types';
import type { SUPPORTED_PLATFORM } from './constants';

export type SupportedPlatform = keyof typeof SUPPORTED_PLATFORM;

export interface IBinaryPathGenerator {
  generate(): string[];
}
export interface IExecutableBinaryPath {
  binaryPathGenerator: IBinaryPathGenerator;
  get(): Promise<string>;
}

export type CommonBinaryOptions = {
  appBuildInfo: AppBuildInfo;
  platform: SupportedPlatform;
  electronVersion?: string;
  packageJsonPath: string;
};

export type ForgeBinaryOptions = Omit<CommonBinaryOptions, 'appBuildInfo'> & {
  appBuildInfo: ForgeBuildInfo;
};

export type BuilderBinaryOptions = Omit<CommonBinaryOptions, 'appBuildInfo'> & {
  appBuildInfo: BuilderBuildInfo;
};
