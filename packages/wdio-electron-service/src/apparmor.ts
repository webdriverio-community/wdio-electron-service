import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createLogger } from '@wdio/electron-utils';

const log = createLogger('apparmor');

/**
 * Checks if AppArmor is active and the unprivileged user namespace restriction is enabled
 * This is the condition that causes Electron to fail on Ubuntu 24.04+
 */
function isApparmorRestricted(): boolean {
  try {
    // Check if AppArmor is active
    const apparmorStatus = spawnSync('aa-status', { encoding: 'utf8' });
    if (apparmorStatus.error || apparmorStatus.status !== 0) {
      log.debug('AppArmor not found or not active');
      return false;
    }

    // Check if the kernel restriction is enabled
    const restrictionPath = '/proc/sys/kernel/apparmor_restrict_unprivileged_userns';
    if (!fs.existsSync(restrictionPath)) {
      log.debug('AppArmor unprivileged user namespace restriction not available');
      return false;
    }

    const restriction = fs.readFileSync(restrictionPath, 'utf8').trim();
    const isRestricted = restriction === '1';
    log.debug(`AppArmor unprivileged user namespace restriction: ${isRestricted ? 'enabled' : 'disabled'}`);
    return isRestricted;
  } catch (error) {
    log.debug('Error checking AppArmor status:', error);
    return false;
  }
}

/**
 * Creates a custom AppArmor profile for Electron applications
 * This is a safer alternative to disabling the kernel restriction entirely
 */
function createElectronApparmorProfile(electronBinaryPath: string): boolean {
  try {
    const profileName = 'electron-wdio-service';
    const profilePath = `/etc/apparmor.d/${profileName}`;

    // Create the AppArmor profile content
    const profileContent = `#include <tunables/global>

${profileName} {
  #include <abstractions/base>
  #include <abstractions/nameservice>
  #include <abstractions/openssl>
  #include <abstractions/ssl_certs>
  #include <abstractions/user-tmp>
  
  # Allow access to the Electron binary
  ${electronBinaryPath} rix,
  
  # Allow user namespace creation (the key fix for Ubuntu 24.04)
  capability sys_admin,
  
  # Allow standard Electron operations
  /usr/bin/xdg-open rix,
  /proc/sys/kernel/yama/ptrace_scope r,
  /sys/devices/system/cpu/online r,
  
  # Allow access to user data directories
  owner @{HOME}/.config/** rwk,
  owner @{HOME}/.cache/** rwk,
  owner @{PROC}/@{pid}/fd/ r,
  owner @{PROC}/@{pid}/stat r,
  owner @{PROC}/@{pid}/statm r,
  
  # Allow network access
  network inet stream,
  network inet6 stream,
  
  # Allow reading system information
  /proc/meminfo r,
  /proc/version r,
  /sys/devices/system/cpu/** r,
  
  # Deny some potentially dangerous operations
  deny @{HOME}/.ssh/** rw,
  deny /etc/passwd r,
  deny /etc/shadow r,
}
`;

    // Check if we can write to /etc/apparmor.d (requires root)
    try {
      fs.accessSync('/etc/apparmor.d', fs.constants.W_OK);
    } catch {
      log.warn(
        'Cannot write AppArmor profile: insufficient permissions. Run with sudo or disable AppArmor restriction manually',
      );
      return false;
    }

    // Write the profile
    fs.writeFileSync(profilePath, profileContent);
    log.debug(`Created AppArmor profile at ${profilePath}`);

    // Load the profile
    execSync(`apparmor_parser -r ${profilePath}`, { encoding: 'utf8' });
    log.info('Successfully created and loaded custom AppArmor profile for Electron');

    return true;
  } catch (error) {
    log.error('Failed to create AppArmor profile:', error);
    return false;
  }
}

/**
 * Applies the AppArmor workaround for Ubuntu 24.04+ Electron issues
 * This should only be called for script-based Electron apps on Linux systems
 * where AppArmor is restricting unprivileged user namespaces
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
 */
export function applyApparmorWorkaround(electronBinaryPath: string): void {
  // Only apply on Linux
  if (process.platform !== 'linux') {
    log.debug('Non-Linux platform detected, skipping AppArmor workaround');
    return;
  }

  log.debug('Checking if AppArmor workaround is needed for Ubuntu 24.04+ compatibility...');

  // Check if AppArmor restriction is active
  if (!isApparmorRestricted()) {
    log.debug('AppArmor restriction not active or not present, no workaround needed');
    return;
  }

  log.info('Detected AppArmor unprivileged user namespace restriction (Ubuntu 24.04+ issue). Applying workaround...');

  // Try to create custom AppArmor profile
  const profileCreated = createElectronApparmorProfile(electronBinaryPath);

  if (!profileCreated) {
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
  }
}
