import path from 'node:path';
import { allOfficialArchsForPlatformAndVersion } from '@electron/packager';
import type {
  AppBuildInfo,
  BinaryPathResult,
  BuilderArch,
  BuilderBuildInfo,
  ForgeBuildInfo,
  PathGenerationError,
  PathGenerationResult,
  PathValidationResult,
} from '@wdio/electron-types';
import { SUPPORTED_BUILD_TOOL, SUPPORTED_PLATFORM } from './constants.js';
import { validateBinaryPaths } from './selectExecutable.js';

type SupportedPlatform = keyof typeof SUPPORTED_PLATFORM;
type SupportedBuildTool = keyof typeof SUPPORTED_BUILD_TOOL;

interface BinaryOptions {
  buildTool: SupportedBuildTool;
  platform: SupportedPlatform;
  appName: string;
  config: ForgeBuildInfo['config'] | BuilderBuildInfo['config'];
  electronVersion?: string;
  projectDir: string;
}

function sanitizeAppNameForPath(appName: string, platform: SupportedPlatform): string {
  // Linux does not support spaces in paths, so we convert the app name to kebab-case before using it
  return platform === 'linux' ? appName.toLowerCase().replace(/ /g, '-') : appName;
}

function getForgeDistDir(
  config: ForgeBuildInfo['config'],
  appName: string,
  platform: SupportedPlatform,
  electronVersion?: string,
): string[] {
  const archs = allOfficialArchsForPlatformAndVersion(platform, electronVersion);
  const forgeOutDir = config?.outDir || 'out';

  // Forge may create directories with different naming conventions depending on the platform
  // We need to check both the original name and sanitized versions
  const possibleNames = [
    appName, // Original name (e.g., "Forge App Example")
    sanitizeAppNameForPath(appName, platform), // Sanitized for platform (e.g., "forge-app-example" on Linux)
  ];

  // Remove duplicates in case sanitization doesn't change the name
  const uniqueNames = [...new Set(possibleNames)];

  return archs.flatMap((arch: string) =>
    uniqueNames.map((name) => path.join(forgeOutDir, `${name}-${platform}-${arch}`)),
  );
}

function getBuilderDistDir(config: BuilderBuildInfo['config'], platform: SupportedPlatform): string[] {
  const builderOutDirName = config?.directories?.output || 'dist';
  const builderOutDirMap = (arch: BuilderArch) => ({
    darwin: path.join(builderOutDirName, arch === 'x64' ? 'mac' : `mac-${arch}`),
    linux: path.join(builderOutDirName, 'linux-unpacked'),
    win32: path.join(builderOutDirName, 'win-unpacked'),
  });
  // return [builderOutDirMap[platform]];
  if (platform === 'darwin') {
    // macOS output dir depends on the arch used
    // - we check all of the possible dirs
    const archs: BuilderArch[] = ['arm64', 'armv7l', 'ia32', 'universal', 'x64'];
    return archs.map((arch) => builderOutDirMap(arch)[platform]);
  } else {
    // other platforms have a single output dir which is not dependent on the arch
    return [builderOutDirMap('x64')[platform]];
  }
}

function getPlatformBinaryPath(
  outDir: string,
  binaryName: string,
  platform: SupportedPlatform,
  options: BinaryOptions,
): string {
  const getExecutableName = (): string => {
    if (
      options.buildTool === SUPPORTED_BUILD_TOOL.builder &&
      (options.config as BuilderBuildInfo['config']).executableName
    ) {
      return (options.config as BuilderBuildInfo['config']).executableName || binaryName;
    }
    return binaryName;
  };

  const binaryPathMap = {
    darwin: () => {
      const executableName = getExecutableName();
      let appBundleName: string;

      if (options.buildTool === SUPPORTED_BUILD_TOOL.forge) {
        // For Forge: use packagerConfig.name for .app bundle, executableName for binary
        const forgeConfig = options.config as ForgeBuildInfo['config'];
        const appDisplayName = forgeConfig.packagerConfig?.name || binaryName;
        appBundleName = `${appDisplayName}.app`;
      } else {
        // For electron-builder: use executableName for .app bundle
        appBundleName = `${executableName}.app`;
      }

      return path.join(appBundleName, 'Contents', 'MacOS', executableName);
    },
    linux: () => sanitizeAppNameForPath(getExecutableName(), platform),
    win32: () => `${getExecutableName()}.exe`,
  };
  return path.join(outDir, binaryPathMap[platform]());
}

function getBinaryName(options: BinaryOptions): string {
  const { buildTool, config, appName } = options;

  if (buildTool === SUPPORTED_BUILD_TOOL.forge) {
    return (config as ForgeBuildInfo['config']).packagerConfig?.executableName || appName;
  }

  // For electron-builder, we use productName for the app bundle name
  return appName;
}

function getOutDir(options: BinaryOptions): string[] {
  const { buildTool, config, appName, platform, electronVersion, projectDir } = options;

  const outDirs =
    buildTool === SUPPORTED_BUILD_TOOL.forge
      ? getForgeDistDir(config as ForgeBuildInfo['config'], appName, platform, electronVersion)
      : getBuilderDistDir(config as BuilderBuildInfo['config'], platform);

  return outDirs.map((dir) => path.join(projectDir, dir));
}

/**
 * Generate possible binary paths for the Electron application
 * Phase 1: Path Generation
 */
export function generateBinaryPaths(
  packageJsonPath: string,
  appBuildInfo: AppBuildInfo,
  electronVersion?: string,
  p = process,
): PathGenerationResult {
  const errors: PathGenerationError[] = [];
  let paths: string[] = [];

  try {
    // Platform validation
    if (!isSupportedPlatform(p.platform)) {
      return {
        success: false,
        paths: [],
        errors: [
          {
            type: 'UNSUPPORTED_PLATFORM',
            message: `Unsupported platform: ${p.platform}`,
          },
        ],
      };
    }

    // Build tool validation
    if (!appBuildInfo.isForge && !appBuildInfo.isBuilder) {
      return {
        success: false,
        paths: [],
        errors: [
          {
            type: 'NO_BUILD_TOOL',
            message: 'Configurations that are neither Forge nor Builder are not supported.',
          },
        ],
      };
    }

    // Generate paths based on build tool configuration
    const options: BinaryOptions = {
      buildTool: appBuildInfo.isForge ? SUPPORTED_BUILD_TOOL.forge : SUPPORTED_BUILD_TOOL.builder,
      platform: p.platform,
      appName: appBuildInfo.appName,
      config: appBuildInfo.config,
      electronVersion,
      projectDir: path.dirname(packageJsonPath),
    };

    try {
      const outDirs = getOutDir(options);
      const binaryName = getBinaryName(options);
      paths = outDirs.map((dir) => getPlatformBinaryPath(dir, binaryName, options.platform, options));

      // Add warning if configuration seems incomplete
      if (appBuildInfo.isBuilder && !appBuildInfo.config?.directories?.output) {
        errors.push({
          type: 'CONFIG_WARNING',
          message:
            'Using default output directory "dist" - consider specifying directories.output in electron-builder config',
          buildTool: 'electron-builder',
          details: 'Missing directories.output field in configuration',
        });
      }

      if (appBuildInfo.isForge && !appBuildInfo.config?.outDir) {
        errors.push({
          type: 'CONFIG_WARNING',
          message: 'Using default output directory "out" - consider specifying outDir in Forge config',
          buildTool: 'electron-forge',
          details: 'Missing outDir field in configuration',
        });
      }
    } catch (error) {
      const buildTool = appBuildInfo.isForge ? 'electron-forge' : 'electron-builder';
      return {
        success: false,
        paths: [],
        errors: [
          {
            type: 'CONFIG_INVALID',
            message: `Failed to generate binary paths from ${buildTool} configuration: ${(error as Error).message}`,
            buildTool,
            details: (error as Error).stack,
          },
        ],
      };
    }
  } catch (error) {
    return {
      success: false,
      paths: [],
      errors: [
        {
          type: 'CONFIG_INVALID',
          message: `Unexpected error during path generation: ${(error as Error).message}`,
          details: (error as Error).stack,
        },
      ],
    };
  }

  return {
    success: paths.length > 0,
    paths,
    errors,
  };
}

/**
 * Determine the path to the Electron application binary using a two-phase approach
 * Returns detailed information about both path generation and validation
 * @param packageJsonPath path to the nearest package.json
 * @param appBuildInfo build information about the Electron application
 * @param electronVersion version of Electron to use
 * @param p process object (used for testing purposes)
 * @returns detailed result with binary path and diagnostic information
 */
export async function getBinaryPath(
  packageJsonPath: string,
  appBuildInfo: AppBuildInfo,
  electronVersion?: string,
  p = process,
): Promise<BinaryPathResult> {
  // Phase 1: Generate possible binary paths
  const pathGeneration = generateBinaryPaths(packageJsonPath, appBuildInfo, electronVersion, p);

  // Phase 2: Validate generated paths
  let pathValidation: PathValidationResult;

  if (!pathGeneration.success || pathGeneration.paths.length === 0) {
    pathValidation = {
      success: false,
      validPath: undefined,
      attempts: [],
    };
  } else {
    pathValidation = await validateBinaryPaths(pathGeneration.paths);
  }

  // Combine results
  const success = pathGeneration.success && pathValidation.success;
  const binaryPath = pathValidation.validPath;

  return {
    success,
    binaryPath,
    pathGeneration,
    pathValidation,
  };
}

function isSupportedPlatform(p: NodeJS.Platform): p is SupportedPlatform {
  return p in SUPPORTED_PLATFORM;
}
