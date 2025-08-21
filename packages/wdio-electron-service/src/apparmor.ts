import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import type { ElectronServiceGlobalOptions } from '@wdio/electron-types';
import { createLogger } from '@wdio/electron-utils';

const log = createLogger('launcher');

/**
 * Checks if AppArmor is active and the unprivileged user namespace restriction is enabled
 * This is the condition that causes Electron to fail on Ubuntu 24.04+
 */
function isApparmorRestricted(): boolean {
  log.debug('Starting AppArmor restriction check...');
  try {
    let isApparmorRunning = false;

    // Method 1: Try aa-status first (best practice when available)
    log.debug('Method 1: Checking AppArmor status with aa-status command');
    try {
      const apparmorStatus = spawnSync('aa-status', { encoding: 'utf8' });
      if (apparmorStatus.status === 0) {
        log.debug('aa-status succeeded - AppArmor is running and accessible');
        isApparmorRunning = true;
      } else if (apparmorStatus.status === 4) {
        log.debug('aa-status failed with exit code 4 - AppArmor is running but insufficient privileges');
        isApparmorRunning = true; // Exit code 4 means AppArmor is present but we lack privileges
      } else {
        log.debug(`aa-status failed with exit code ${apparmorStatus.status} - falling back to filesystem check`);
      }
    } catch (error) {
      log.debug(
        `aa-status command failed: ${error instanceof Error ? error.message : String(error)} - falling back to filesystem check`,
      );
    }

    // Method 2: Fallback to filesystem check if aa-status wasn't conclusive
    if (!isApparmorRunning) {
      log.debug('Method 2: Checking AppArmor status via filesystem');
      const apparmorProfilesPath = '/sys/kernel/security/apparmor/profiles';

      if (fs.existsSync(apparmorProfilesPath)) {
        try {
          const profiles = fs.readFileSync(apparmorProfilesPath, 'utf8').trim();
          isApparmorRunning = profiles.length > 0;
          log.debug(
            `AppArmor profiles file ${isApparmorRunning ? 'has content' : 'is empty'} - AppArmor is ${isApparmorRunning ? 'RUNNING' : 'NOT RUNNING'}`,
          );
        } catch (error) {
          log.debug(
            'Cannot read AppArmor profiles file - may lack permissions, assuming AppArmor is running',
            (error as Error).message,
          );
          isApparmorRunning = true; // Assume running if we can't read (permission issue)
        }
      } else {
        log.debug('AppArmor profiles file not found - AppArmor is not running');
      }
    }

    // If AppArmor is not running, no workaround needed
    if (!isApparmorRunning) {
      log.debug('AppArmor not running, no workaround needed');
      return false;
    }

    log.debug('AppArmor confirmed as running, checking unprivileged user namespace restriction');

    // Check the specific kernel restriction that breaks Electron
    const restrictionPath = '/proc/sys/kernel/apparmor_restrict_unprivileged_userns';
    log.debug(`Checking restriction file: ${restrictionPath}`);

    if (!fs.existsSync(restrictionPath)) {
      log.debug('Restriction file not found - this could indicate:');
      log.debug('  - Kernel version < 5.15 (restriction not available)');
      log.debug('  - AppArmor compiled without userns support');
      log.debug('  - Other AppArmor configuration preventing Electron');
      log.debug('Applying workaround as precaution since AppArmor is active');
      return true; // Apply workaround when AppArmor is active but we can't check the specific restriction
    }

    const restriction = fs.readFileSync(restrictionPath, 'utf8').trim();
    const isRestricted = restriction === '1';
    log.debug(
      `Restriction value: '${restriction}' (${isRestricted ? 'ENABLED - workaround needed' : 'DISABLED - no workaround needed'})`,
    );

    return isRestricted;
  } catch (error) {
    log.debug(`Error during AppArmor restriction check: ${error instanceof Error ? error.message : String(error)}`);
    log.debug('Applying workaround due to detection uncertainty (better safe than sorry)');
    return true;
  }
}

/**
 * Checks if we can run sudo non-interactively
 */
function canUseSudo(): boolean {
  try {
    // Test if sudo -n (non-interactive) works
    const result = spawnSync('sudo', ['-n', 'true'], { encoding: 'utf8' });
    return result.status === 0;
  } catch (error) {
    log.debug(`sudo check failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Checks if we're running as root
 */
function isRoot(): boolean {
  const uid = process.getuid?.();
  return uid !== undefined && uid === 0;
}

/**
 * Creates a custom AppArmor profile for Electron applications
 * This is a safer alternative to disabling the kernel restriction entirely
 */
function createElectronApparmorProfile(
  electronBinaryPaths: string[],
  installMode: ElectronServiceGlobalOptions['apparmorAutoInstall'],
): boolean {
  log.debug(
    `Starting AppArmor profile creation for ${electronBinaryPaths.length} binaries: ${electronBinaryPaths.join(', ')}`,
  );
  try {
    const profileName = 'electron-wdio-service';
    const profilePath = `/etc/apparmor.d/${profileName}`;
    log.debug(`Profile name: ${profileName}`);
    log.debug(`Profile path: ${profilePath}`);

    // Create individual profiles for each Electron binary using Ubuntu's recommended approach
    const profiles = electronBinaryPaths.map((binaryPath) => {
      const binaryName = binaryPath.split('/').pop() || 'electron';
      return `# AppArmor profile for Electron binary: ${binaryPath}
# This profile allows unprivileged user namespaces for Electron on Ubuntu 24.04+
abi <abi/4.0>,
include <tunables/global>

profile ${binaryName}-${profileName} "${binaryPath}" flags=(unconfined) {
  userns,
  
  # Site-specific additions and overrides
  include if exists <local/${binaryName}-${profileName}>
}`;
    });

    const profileContent = profiles.join('\n\n');

    // Determine if we should proceed based on install mode and permissions
    const hasRootAccess = isRoot();
    const hasSudoAccess = installMode === 'sudo' && canUseSudo();
    const shouldProceed =
      installMode === true ? hasRootAccess : installMode === 'sudo' ? hasRootAccess || hasSudoAccess : false;

    if (!shouldProceed) {
      if (installMode === true && !hasRootAccess) {
        log.debug('AppArmor auto-install enabled but not running as root (apparmorAutoInstall: true)');
      } else if (installMode === 'sudo' && !hasRootAccess && !hasSudoAccess) {
        log.debug('AppArmor auto-install with sudo enabled but sudo not available (apparmorAutoInstall: "sudo")');
      }
      return false;
    }

    // Check if we can write to /etc/apparmor.d (requires root or sudo)
    log.debug('Checking write permissions for /etc/apparmor.d directory');
    const needsSudo = !hasRootAccess && hasSudoAccess;

    // Write the profile (using sudo if needed)
    log.debug(`Writing AppArmor profile content to file system${needsSudo ? ' using sudo' : ''}`);
    if (needsSudo) {
      // Use sudo to write the file
      execSync(`sudo tee ${profilePath} > /dev/null`, { input: profileContent, encoding: 'utf8' });
    } else {
      fs.writeFileSync(profilePath, profileContent);
    }
    log.debug(`AppArmor profile file created at ${profilePath}`);

    // Load the profile (using sudo if needed)
    log.debug('Loading AppArmor profile using apparmor_parser');
    const parserCommand = needsSudo ? `sudo apparmor_parser -r ${profilePath}` : `apparmor_parser -r ${profilePath}`;
    log.debug(`Running command: ${parserCommand}`);
    execSync(parserCommand, { encoding: 'utf8' });
    log.info('Successfully created and loaded custom AppArmor profile for Electron');
    log.debug('AppArmor profile creation completed successfully');

    return true;
  } catch (error) {
    log.error(`Failed to create AppArmor profile: ${error instanceof Error ? error.message : String(error)}`);
    log.debug('AppArmor profile creation failed, falling back to manual workaround suggestion');
    return false;
  }
}

/**
 * Applies the AppArmor workaround for Ubuntu 24.04+ Electron issues
 * This should be called once per session with all discovered Electron binaries
 *
 * Compatible with:
 * - Ubuntu 24.04+ (primary target)
 * - openSUSE with AppArmor enabled
 * - Other AppArmor-enabled Linux distributions
 *
 * Safe on:
 * - Non-Linux platforms (no-op)
 * - Linux without AppArmor (RHEL, Fedora, Arch, etc.)
 * - Systems where AppArmor restriction is already disabled
 * - CI environments (respects apparmorAutoInstall configuration)
 */
export function applyApparmorWorkaround(
  electronBinaryPaths: string[],
  installMode: ElectronServiceGlobalOptions['apparmorAutoInstall'] = false,
): void {
  log.debug(`=== AppArmor Workaround Check Started ===`);
  log.debug(`Target Electron binaries: ${electronBinaryPaths.join(', ')}`);
  log.debug(`Platform: ${process.platform}`);
  log.debug(`Install mode: ${installMode}`);

  // Only apply on Linux
  if (process.platform !== 'linux') {
    log.debug('Non-Linux platform detected, skipping AppArmor workaround');
    log.debug(`=== AppArmor Workaround Check Completed (Non-Linux) ===`);
    return;
  }

  // Skip if auto-install is disabled
  if (installMode === false) {
    log.debug('AppArmor auto-install disabled, skipping workaround');
    log.debug(`=== AppArmor Workaround Check Completed (Disabled) ===`);
    return;
  }

  log.debug('Linux platform detected, checking if AppArmor workaround is needed for Ubuntu 24.04+ compatibility...');

  // Check if AppArmor restriction is active
  log.debug('Calling isApparmorRestricted() to determine if workaround is needed');
  if (!isApparmorRestricted()) {
    log.debug('AppArmor restriction not active or not present, no workaround needed');
    log.debug(`=== AppArmor Workaround Check Completed (No Restriction) ===`);
    return;
  }

  log.info('Detected AppArmor unprivileged user namespace restriction (Ubuntu 24.04+ issue). Applying workaround...');
  log.debug('Proceeding with AppArmor profile creation');

  // Try to create custom AppArmor profile
  log.debug('Attempting to create custom AppArmor profile');
  const profileCreated = createElectronApparmorProfile(electronBinaryPaths, installMode);
  log.debug(`Profile creation result: ${profileCreated ? 'SUCCESS' : 'FAILED'}`);

  if (!profileCreated) {
    log.debug('Profile creation failed, displaying manual workaround instructions');
    // Fall back to suggesting the kernel workaround
    log.warn(`
AppArmor restriction detected but could not create custom profile.
This may cause Electron to fail to start on Ubuntu 24.04+ and similar systems.

To fix this issue manually, run one of the following commands:

1. Disable the restriction temporarily:
   sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0

2. Or disable it permanently:
   echo 'kernel.apparmor_restrict_unprivileged_userns=0' | sudo tee -a /etc/sysctl.conf

See: https://github.com/electron/electron/issues/41066
    `);
  } else {
    log.debug('AppArmor profile created successfully, workaround applied');
  }

  log.debug(`=== AppArmor Workaround Check Completed (${profileCreated ? 'Success' : 'Manual Required'}) ===`);
}
