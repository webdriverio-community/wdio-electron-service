import path from 'node:path';

import getPort from 'get-port';
import { SevereServiceError } from 'webdriverio';
import { readPackageUp, type NormalizedReadResult } from 'read-package-up';
import { log, getAppBuildInfo, getElectronVersion, getBinaryPath } from '@wdio/electron-utils';

import {
  getChromeOptions,
  getChromedriverOptions,
  getConvertedElectronCapabilities,
  getElectronCapabilities,
} from './capabilities.js';
import { getChromiumVersion } from './versions.js';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';

import type { Services, Options, Capabilities } from '@wdio/types';
import type {
  ElectronServiceCapabilities,
  ElectronServiceGlobalOptions,
  AppBuildInfo,
  BinaryPathResult,
  PathGenerationError,
} from '@wdio/electron-types';

/**
 * Generate a comprehensive error message based on the binary path detection result
 */
function generateBinaryPathErrorMessage(result: BinaryPathResult, appBuildInfo: AppBuildInfo): string {
  const buildToolName = appBuildInfo.isForge ? 'Electron Forge' : 'electron-builder';
  const suggestedCompileCommand = `npx ${appBuildInfo.isForge ? 'electron-forge make' : 'electron-builder build'}`;

  // Path generation failed
  if (!result.pathGeneration.success) {
    const generationErrors = result.pathGeneration.errors;
    const primaryError = generationErrors[0];

    switch (primaryError?.type) {
      case 'UNSUPPORTED_PLATFORM':
        return `Unsupported platform: ${process.platform}. This service only supports Windows, macOS, and Linux.`;

      case 'NO_BUILD_TOOL':
        return 'No supported build tool configuration found. Please configure either Electron Forge or electron-builder in your package.json.';

      case 'CONFIG_INVALID':
        return `Invalid ${buildToolName} configuration: ${primaryError.message}. Please check your build tool configuration.`;

      case 'CONFIG_MISSING':
        return `Missing ${buildToolName} configuration. Please ensure your build tool is properly configured in package.json.`;

      default:
        return `Failed to determine binary paths: ${primaryError?.message || 'Unknown error'}`;
    }
  }

  // Path generation succeeded but validation failed
  if (!result.pathValidation.success) {
    const attempts = result.pathValidation.attempts;

    let errorDetails = `Checked ${attempts.length} possible location(s):`;

    for (const attempt of attempts) {
      errorDetails += `\n  - ${attempt.path}`;
      if (attempt.error) {
        switch (attempt.error.type) {
          case 'FILE_NOT_FOUND':
            errorDetails += ' (file not found)';
            break;
          case 'NOT_EXECUTABLE':
            errorDetails += ' (not executable)';
            break;
          case 'PERMISSION_DENIED':
            errorDetails += ' (permission denied)';
            break;
          case 'IS_DIRECTORY':
            errorDetails += ' (is a directory)';
            break;
          default:
            errorDetails += ` (${attempt.error.message})`;
        }
      }
    }

    return `Could not find Electron app built with ${buildToolName}!\n\n${errorDetails}\n\nIf the application is not compiled, please do so before running your tests:\n  ${suggestedCompileCommand}\n\nOtherwise if the application is compiled at a different location, please specify the \`appBinaryPath\` option in your capabilities.`;
  }

  return 'Unknown error occurred while detecting binary path.';
}

export default class ElectronLaunchService implements Services.ServiceInstance {
  #globalOptions: ElectronServiceGlobalOptions;
  #projectRoot: string;

  constructor(globalOptions: ElectronServiceGlobalOptions, _caps: unknown, config: Options.Testrunner) {
    this.#globalOptions = globalOptions;
    this.#projectRoot = globalOptions.rootDir || config.rootDir || process.cwd();
  }

  async onPrepare(_config: Options.Testrunner, capabilities: ElectronServiceCapabilities) {
    const capsList = Array.isArray(capabilities)
      ? capabilities
      : Object.values(capabilities as Capabilities.RequestedMultiremoteCapabilities).map(
          (multiremoteOption) => (multiremoteOption as Capabilities.WithRequestedCapabilities).capabilities,
        );

    const caps = capsList.flatMap((cap) => getElectronCapabilities(cap) as WebdriverIO.Capabilities);
    const pkg =
      (await readPackageUp({ cwd: this.#projectRoot })) ||
      ({ packageJson: { dependencies: {}, devDependencies: {} } } as NormalizedReadResult);

    if (!caps.length) {
      const noElectronCapabilityError = new Error('No Electron browser found in capabilities');
      log.error(noElectronCapabilityError);
      throw noElectronCapabilityError;
    }

    const localElectronVersion = await getElectronVersion(pkg);

    await Promise.all(
      caps.map(async (cap) => {
        const electronVersion = cap.browserVersion || localElectronVersion || '';
        const chromiumVersion = await getChromiumVersion(electronVersion);
        log.info(`Found Electron v${electronVersion} with Chromedriver v${chromiumVersion}`);

        if (Number.parseInt(electronVersion.split('.')[0]) < 26 && !cap['wdio:chromedriverOptions']?.binary) {
          const invalidElectronVersionError = new SevereServiceError(
            'Electron version must be 26 or higher for auto-configuration of Chromedriver.  If you want to use an older version of Electron, you must configure Chromedriver manually using the wdio:chromedriverOptions capability',
          );
          log.error(invalidElectronVersionError.message);
          throw invalidElectronVersionError;
        }

        let {
          appBinaryPath,
          appEntryPoint,
          appArgs = ['--no-sandbox'],
        } = Object.assign({}, this.#globalOptions, cap[CUSTOM_CAPABILITY_NAME]);

        if (appEntryPoint) {
          if (appBinaryPath) {
            log.warn('Both appEntryPoint and appBinaryPath are set, appBinaryPath will be ignored');
          }
          const electronBinary = process.platform === 'win32' ? 'electron.CMD' : 'electron';
          const packageDir = path.dirname(pkg.path);
          appBinaryPath = path.join(packageDir, 'node_modules', '.bin', electronBinary);
          appArgs = [`--app=${appEntryPoint}`, ...appArgs];
          log.debug('App entry point: ', appEntryPoint, appBinaryPath, appArgs);
        } else if (!appBinaryPath) {
          log.info('No app binary specified, attempting to detect one...');
          try {
            const appBuildInfo = await getAppBuildInfo(pkg);

            try {
              // Use the detailed binary path function for better error handling
              const binaryResult = await getBinaryPath(pkg.path, appBuildInfo, electronVersion);

              if (binaryResult.success) {
                appBinaryPath = binaryResult.binaryPath!;
                log.info(`Detected app binary at ${appBinaryPath}`);

                // Log any warnings from path generation
                const warnings = binaryResult.pathGeneration.errors.filter(
                  (e: PathGenerationError) => e.type === 'CONFIG_WARNING',
                );
                warnings.forEach((warning: PathGenerationError) => log.warn(warning.message));
              } else {
                // Generate comprehensive error message based on what failed
                const errorMessage = generateBinaryPathErrorMessage(binaryResult, appBuildInfo);
                throw new Error(errorMessage);
              }
            } catch (e) {
              // Fallback to original error handling for backward compatibility
              if (e instanceof Error && !e.message.includes('Could not find Electron app')) {
                const buildToolName = appBuildInfo.isForge ? 'Electron Forge' : 'electron-builder';
                const suggestedCompileCommand = `npx ${
                  appBuildInfo.isForge ? 'electron-forge make' : 'electron-builder build'
                }`;
                throw new Error(
                  `Could not find Electron app built with ${buildToolName}!\nIf the application is not compiled, please do so before running your tests, e.g. via \`${suggestedCompileCommand}\`.`,
                );
              }
              throw e;
            }
          } catch (e) {
            log.error(e);
            throw new SevereServiceError((e as Error).message);
          }
        }

        cap.browserName = 'chrome';
        cap['goog:chromeOptions'] = getChromeOptions({ appBinaryPath, appArgs }, cap);

        // disable WebDriver Bidi session
        cap['wdio:enforceWebDriverClassic'] = true;

        const chromedriverOptions = getChromedriverOptions(cap);
        if (!chromiumVersion && Object.keys(chromedriverOptions).length > 0) {
          cap['wdio:chromedriverOptions'] = chromedriverOptions;
        }

        const browserVersion = chromiumVersion || cap.browserVersion;
        if (browserVersion) {
          cap.browserVersion = browserVersion;
        } else if (!cap['wdio:chromedriverOptions']?.binary) {
          const invalidBrowserVersionOptsError = new Error(
            'You must install Electron locally, or provide a custom Chromedriver path / browserVersion value for each Electron capability',
          );
          log.error(invalidBrowserVersionOptsError);
          throw invalidBrowserVersionOptsError;
        }

        /**
         * attach custom capability to be able to identify Electron instances
         * in the worker process
         */
        cap[CUSTOM_CAPABILITY_NAME] = cap[CUSTOM_CAPABILITY_NAME] || {};

        log.debug('Setting capability at onPrepare', cap);
      }),
    ).catch((err) => {
      const msg = `Failed setting up Electron session: ${err.stack}`;
      log.error(msg);
      throw new SevereServiceError(msg);
    });
  }

  /**
   * Assigns unique debugging ports to each Electron instance to prevent port conflicts
   * when running multiple Electron instances concurrently.
   *
   * This method runs at the beginning of each worker process and:
   * 1. Dynamically finds available ports using get-port
   * 2. Adds the --inspect flag with the assigned port to each Electron instance
   * 3. Ensures each Electron instance has a unique debugging port
   *
   * This allows for reliable parallel debugging of multiple Electron instances.
   */
  async onWorkerStart(_cid: string, capabilities: WebdriverIO.Capabilities) {
    try {
      const capsList = Array.isArray(capabilities) ? (capabilities as WebdriverIO.Capabilities[]) : [capabilities];
      const caps = capsList.flatMap((cap) => getConvertedElectronCapabilities(cap) as WebdriverIO.Capabilities);

      const portList = await getDebuggerPorts(caps.length);

      await Promise.all(
        caps.map(async (cap, index) => {
          setInspectArg(cap, portList[index]);
        }),
      );
      log.debug('Setting capability at onWorkerStart', JSON.stringify(caps));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.stack || error.message : String(error);
      const msg = `Failed to assign debugging ports to Electron instances: ${errorMessage}`;
      log.error(msg);
      throw new SevereServiceError(msg);
    }
  }
}

/**
 * Dynamically allocates available ports for Electron debugger instances
 *
 * @param quantity Number of ports needed (one per Electron instance)
 * @returns Array of available port numbers
 */
const getDebuggerPorts = async (quantity: number): Promise<number[]> => {
  return Promise.all(Array.from({ length: quantity }, () => getPort()));
};

/**
 * Configures an Electron capability with the necessary debugging arguments
 * by adding the --inspect flag with the assigned port to chrome options
 *
 * @param cap WebdriverIO capability to modify
 * @param debuggerPort Port number to use for the Node inspector
 */
const setInspectArg = (cap: WebdriverIO.Capabilities, debuggerPort: number) => {
  if (!('goog:chromeOptions' in cap)) {
    cap['goog:chromeOptions'] = { args: [] };
  }
  const chromeOptions = cap['goog:chromeOptions']!;
  if (!('args' in chromeOptions)) {
    chromeOptions.args = [];
  }
  chromeOptions.args!.push(`--inspect=localhost:${debuggerPort}`);
};
