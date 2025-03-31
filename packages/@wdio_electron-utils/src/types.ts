import type { AppBuildInfo, BuilderBuildInfo, ForgeBuildInfo } from '@wdio/electron-types';
import type { SUPPORTED_BUILD_TOOL, SUPPORTED_PLATFORM } from './constants.js';

export type SupportedPlatform = keyof typeof SUPPORTED_PLATFORM;

export type SupportedBuildTool = keyof typeof SUPPORTED_BUILD_TOOL;

export interface IBinaryPathGenerator {
  generate(): string[];
}
export interface IExecutableBinaryPath {
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
