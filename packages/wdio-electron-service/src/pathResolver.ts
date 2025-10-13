import { access } from 'node:fs/promises';
import path from 'node:path';
import type { NormalizedReadResult } from 'read-package-up';

/**
 * Validate that a file path exists and is accessible
 * @param filePath - The path to validate
 * @param pathType - Description of the path type for error messages (e.g., "App entry point", "App binary")
 * @returns The validated path
 * @throws Error if the file doesn't exist or isn't accessible
 */
export async function validateFilePath(filePath: string, pathType: string): Promise<string> {
  try {
    await access(filePath);
    return filePath;
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    let errorMessage = `${pathType} not found: ${filePath}\n\n`;

    if (errorCode === 'ENOENT') {
      errorMessage += `The specified ${pathType.toLowerCase()} does not exist. Please ensure:\n`;
      errorMessage += `1. The path is correct\n`;
      errorMessage += `2. The application has been built\n`;
      errorMessage += `3. The file is accessible from the test directory\n\n`;
      errorMessage += `Current working directory: ${process.cwd()}`;
    } else if (errorCode === 'EACCES') {
      errorMessage += `Permission denied. The file exists but is not accessible.\n`;
      errorMessage += `Please check file permissions.`;
    } else {
      errorMessage += `Unable to access file: ${(error as Error).message}`;
    }

    throw new Error(errorMessage);
  }
}

/**
 * Configure app to use entry point (development mode with electron binary)
 * @param appEntryPoint - Path to the app entry point
 * @param pkg - Package information
 * @param existingAppArgs - Existing app arguments to prepend to
 * @returns Configuration object with binary path and arguments
 */
function configureEntryPoint(
  appEntryPoint: string,
  pkg: NormalizedReadResult,
  existingAppArgs: string[],
): { appBinaryPath: string; appArgs: string[] } {
  const electronBinary = process.platform === 'win32' ? 'electron.CMD' : 'electron';
  const packageDir = path.dirname(pkg.path);
  const appBinaryPath = path.join(packageDir, 'node_modules', '.bin', electronBinary);
  const appArgs = [`--app=${appEntryPoint}`, ...existingAppArgs];
  return { appBinaryPath, appArgs };
}

export interface PathResolutionResult {
  appBinaryPath: string;
  appArgs: string[];
  logMessages: Array<{ level: 'info' | 'warn' | 'debug'; message: string; args?: unknown[] }>;
}

/**
 * Resolve and validate app paths with proper precedence and fallback handling
 * @param options Configuration options
 * @returns Resolved paths and arguments with log messages to emit
 * @throws Error if validation fails or no valid paths are found
 */
export async function resolveAppPaths(options: {
  appEntryPoint?: string;
  appBinaryPath?: string;
  appArgs: string[];
  pkg: NormalizedReadResult;
}): Promise<PathResolutionResult> {
  const { appEntryPoint, appBinaryPath, appArgs, pkg } = options;
  const logMessages: PathResolutionResult['logMessages'] = [];

  // Handle path validation and resolution with proper precedence
  if (appEntryPoint && appBinaryPath) {
    // Both paths provided - validate with fallback logic
    let appEntryPointValid = false;
    let appBinaryPathValid = false;

    try {
      await validateFilePath(appEntryPoint, 'App entry point');
      appEntryPointValid = true;
    } catch (entryPointError) {
      logMessages.push({
        level: 'debug',
        message: `appEntryPoint validation failed: ${(entryPointError as Error).message}`,
      });
    }

    try {
      await validateFilePath(appBinaryPath, 'App binary');
      appBinaryPathValid = true;
    } catch (binaryPathError) {
      logMessages.push({
        level: 'debug',
        message: `appBinaryPath validation failed: ${(binaryPathError as Error).message}`,
      });
    }

    if (appEntryPointValid && appBinaryPathValid) {
      // Both valid - use appEntryPoint as documented
      logMessages.push({
        level: 'info',
        message: 'Both appEntryPoint and appBinaryPath are set, using appEntryPoint (appBinaryPath ignored)',
      });
      const config = configureEntryPoint(appEntryPoint, pkg, appArgs);
      logMessages.push({
        level: 'debug',
        message: 'App entry point: ',
        args: [appEntryPoint, config.appBinaryPath, config.appArgs],
      });
      return { ...config, logMessages };
    }

    if (appEntryPointValid) {
      // Only appEntryPoint valid
      logMessages.push({
        level: 'info',
        message: 'Using appEntryPoint (appBinaryPath is invalid and ignored)',
      });
      const config = configureEntryPoint(appEntryPoint, pkg, appArgs);
      logMessages.push({
        level: 'debug',
        message: 'App entry point: ',
        args: [appEntryPoint, config.appBinaryPath, config.appArgs],
      });
      return { ...config, logMessages };
    }

    if (appBinaryPathValid) {
      // Only appBinaryPath valid - fall back to it
      logMessages.push({
        level: 'warn',
        message: `appEntryPoint not found (${appEntryPoint}), falling back to appBinaryPath`,
      });
      return { appBinaryPath, appArgs, logMessages };
    }

    // Both invalid
    throw new Error(
      `Both appEntryPoint and appBinaryPath not found:\n\n` +
        `- appEntryPoint: ${appEntryPoint} (does not exist)\n` +
        `- appBinaryPath: ${appBinaryPath} (does not exist)\n\n` +
        `Please:\n` +
        `1. Check that the paths are correct\n` +
        `2. Ensure the application has been built\n` +
        `3. Or remove these options to enable auto-detection`,
    );
  }

  if (appEntryPoint) {
    // Only appEntryPoint provided - validate it
    await validateFilePath(appEntryPoint, 'App entry point');
    const config = configureEntryPoint(appEntryPoint, pkg, appArgs);
    logMessages.push({
      level: 'debug',
      message: 'App entry point: ',
      args: [appEntryPoint, config.appBinaryPath, config.appArgs],
    });
    return { ...config, logMessages };
  }

  if (appBinaryPath) {
    // Only appBinaryPath provided - validate it
    await validateFilePath(appBinaryPath, 'App binary');
    return { appBinaryPath, appArgs, logMessages };
  }

  // Neither provided - caller should handle auto-detection
  throw new Error('No paths provided for resolution');
}
