import { createLogger } from '@wdio/electron-utils';

const log = createLogger('fuses');

export interface FuseCheckResult {
  canUseCdpBridge: boolean;
  fuseValue?: number;
  error?: string;
}

/**
 * Checks if the Electron binary has the EnableNodeCliInspectArguments fuse enabled.
 * The CDP bridge requires this fuse to be enabled (default) to work properly.
 *
 * @param binaryPath - Path to the Electron binary
 * @returns Result indicating whether CDP bridge can be used
 */
export async function checkInspectFuse(binaryPath: string): Promise<FuseCheckResult> {
  try {
    log.debug(`Checking EnableNodeCliInspectArguments fuse for: ${binaryPath}`);

    // @ts-expect-error Dynamic import required - @electron/fuses is external at runtime
    const { getCurrentFuseWire, FuseVersion, FuseV1Options, FuseState } = await import('@electron/fuses');
    const config = await getCurrentFuseWire(binaryPath);

    // If we can't read the config (e.g., older Electron version without fuses),
    // assume it's safe to proceed
    if (!config) {
      log.debug('No fuse config found (likely older Electron version), assuming CDP bridge is usable');
      return { canUseCdpBridge: true };
    }

    // Check if we have V1 fuses
    if (config.version === FuseVersion.V1) {
      const inspectFuse = config[FuseV1Options.EnableNodeCliInspectArguments];

      log.debug(`EnableNodeCliInspectArguments fuse value: ${inspectFuse}`);

      // The fuse is enabled by default (FuseState.ENABLE). If it's explicitly set to DISABLE,
      // the CDP bridge won't work
      if (inspectFuse === FuseState.DISABLE) {
        log.warn('EnableNodeCliInspectArguments fuse is disabled - CDP bridge will not work');
        return {
          canUseCdpBridge: false,
          fuseValue: inspectFuse,
        };
      }

      return { canUseCdpBridge: true, fuseValue: inspectFuse };
    }

    // No V1 fuses found, assume safe
    log.debug('No V1 fuses found, assuming CDP bridge is usable');
    return { canUseCdpBridge: true };
  } catch (error) {
    // If we can't read the fuses (e.g., invalid binary, permission issues),
    // log a warning but don't block - let the connection attempt fail naturally
    // with its own error message
    log.debug(`Failed to check fuses: ${error instanceof Error ? error.message : String(error)}`);
    log.debug('Proceeding with CDP bridge connection attempt');
    return {
      canUseCdpBridge: true,
      error: `Could not verify fuse configuration: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
