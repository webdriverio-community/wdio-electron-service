import type {
  AppBuildInfo,
  BinaryPathResult,
  ElectronServiceCapabilities,
  ElectronServiceGlobalOptions,
  PathGenerationError,
} from '@wdio/electron-types';
import { createLogger, getAppBuildInfo, getBinaryPath, getElectronVersion } from '@wdio/electron-utils';

const log = createLogger('launcher');

import type { Capabilities, Options, Services } from '@wdio/types';
import getPort from 'get-port';
import { type NormalizedReadResult, readPackageUp } from 'read-package-up';
import { SevereServiceError } from 'webdriverio';
import { applyApparmorWorkaround } from './apparmor.js';
import {
  getChromedriverOptions,
  getChromeOptions,
  getConvertedElectronCapabilities,
  getElectronCapabilities,
} from './capabilities.js';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';
import { resolveAppPaths } from './pathResolver.js';
import { getChromiumVersion } from './versions.js';

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

    // Track unique binary paths for AppArmor workaround
    const uniqueBinaryPaths = new Set<string>();
    let apparmorAutoInstall: ElectronServiceGlobalOptions['apparmorAutoInstall'] =
      this.#globalOptions.apparmorAutoInstall;

    await Promise.all(
      caps.map(async (cap) => {
        const electronVersion = cap.browserVersion || localElectronVersion || '';
        const chromiumVersion = await getChromiumVersion(electronVersion);
        log.info(`Found Electron v${electronVersion} with Chromedriver v${chromiumVersion}`);

        if (Number.parseInt(electronVersion.split('.')[0], 10) < 26 && !cap['wdio:chromedriverOptions']?.binary) {
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
          apparmorAutoInstall: capApparmorAutoInstall,
        } = Object.assign({}, this.#globalOptions, cap[CUSTOM_CAPABILITY_NAME]);

        // Use capability-level apparmorAutoInstall if provided, otherwise keep the existing value
        if (capApparmorAutoInstall !== undefined) {
          apparmorAutoInstall = capApparmorAutoInstall;
        }

        // Handle path validation and resolution with proper precedence
        if (appEntryPoint || appBinaryPath) {
          const result = await resolveAppPaths({ appEntryPoint, appBinaryPath, appArgs, pkg });
          appBinaryPath = result.appBinaryPath;
          appArgs = result.appArgs;

          // Emit log messages from path resolution
          for (const logMessage of result.logMessages) {
            if (logMessage.args) {
              log[logMessage.level](logMessage.message, ...logMessage.args);
            } else {
              log[logMessage.level](logMessage.message);
            }
          }
        } else {
          // Neither provided - use auto-detection
          log.info('No app binary specified, attempting to detect one...');
          try {
            const appBuildInfo = await getAppBuildInfo(pkg);

            try {
              // Use the detailed binary path function for better error handling
              const binaryResult = await getBinaryPath(pkg.path, appBuildInfo, electronVersion);

              if (binaryResult.success && binaryResult.binaryPath) {
                appBinaryPath = binaryResult.binaryPath;
                log.info(`Detected app binary at ${appBinaryPath}`);

                // Log any warnings from path generation
                const warnings = binaryResult.pathGeneration.errors.filter(
                  (e: PathGenerationError) => e.type === 'CONFIG_WARNING',
                );
                warnings.forEach((warning: PathGenerationError) => {
                  log.warn(warning.message);
                });
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

        // Collect binary path for AppArmor workaround (applied once per unique path after loop)
        if (appBinaryPath) {
          uniqueBinaryPaths.add(appBinaryPath);
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

    // Apply AppArmor workaround once per session with all discovered binary paths
    if (uniqueBinaryPaths.size > 0) {
      applyApparmorWorkaround(Array.from(uniqueBinaryPaths), apparmorAutoInstall);
    }
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
  const chromeOptions = cap['goog:chromeOptions'];
  if (!chromeOptions) {
    return;
  }
  if (!('args' in chromeOptions)) {
    chromeOptions.args = [];
  }
  if (Array.isArray(chromeOptions.args)) {
    chromeOptions.args.push(`--inspect=localhost:${debuggerPort}`);
  }
};
