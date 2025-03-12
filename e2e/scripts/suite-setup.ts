/**
 * Suite-level setup script for WebdriverIO tests
 * This script prepares the test apps once for the entire test suite
 * and sets environment variables for all tests to use.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { testAppsManager } from '../setup/testAppsManager.js';

const execAsync = promisify(exec);

/**
 * Kill all running Electron processes
 */
async function killElectronProcesses() {
  console.log('🔪 Killing any remaining Electron processes...');
  try {
    if (process.platform === 'win32') {
      // On Windows, use taskkill with /F to force kill
      await execAsync('taskkill /F /IM electron.exe /T');
    } else {
      // On Unix-like systems, try multiple approaches to ensure all processes are killed
      try {
        // First try pkill with -f to match command line
        await execAsync('pkill -f electron');
      } catch (_) {
        // Ignore errors, as they likely mean no processes were found
      }

      try {
        // Also try to kill by process name
        await execAsync('pkill -9 -f Electron');
      } catch (_) {
        // Ignore errors
      }

      try {
        // Also try to kill any node processes related to electron
        await execAsync('pkill -f "node.*electron"');
      } catch (_) {
        // Ignore errors
      }

      // On macOS, also try to kill by app bundle
      if (process.platform === 'darwin') {
        try {
          await execAsync('pkill -f "example-.*\\.app"');
        } catch (_) {
          // Ignore errors
        }
      }
    }
    console.log('✅ Electron processes killed');
  } catch (_error) {
    // Ignore errors as they likely mean no processes were found
    console.log('ℹ️ No Electron processes found to kill');
  }
}

/**
 * Prepare test apps for the entire test suite
 */
async function setupTestSuite() {
  console.log('🚀 Performing suite-level setup...');

  try {
    // Kill any leftover Electron processes first
    await killElectronProcesses();

    // Check if test apps are already prepared
    if (testAppsManager.isTestAppsPrepared()) {
      console.log('✅ Test apps already prepared, reusing existing setup');
      const tmpDir = testAppsManager.getTmpDir();
      if (tmpDir) {
        process.env.WDIO_TEST_APPS_PREPARED = 'true';
        process.env.WDIO_TEST_APPS_DIR = tmpDir;
        console.log(`📂 Using existing test apps directory: ${tmpDir}`);
      }
      return;
    }

    // Prepare test apps
    console.log('📦 Preparing test apps...');

    // Log the PRESERVE_TEMP_DIR environment variable
    if (process.env.PRESERVE_TEMP_DIR === 'true') {
      console.log('🔒 Temp directory will be preserved (PRESERVE_TEMP_DIR=true)');
    }

    const tmpDir = await testAppsManager.prepareTestApps();

    // Set environment variables for all tests to use
    process.env.WDIO_TEST_APPS_PREPARED = 'true';
    process.env.WDIO_TEST_APPS_DIR = tmpDir;

    console.log(`✅ Suite setup complete. Test apps prepared at: ${tmpDir}`);
  } catch (error) {
    console.error('❌ Suite setup failed:', error);
    process.exit(1);
  }
}

/**
 * Clean up test apps after the entire test suite
 */
async function cleanupTestSuite() {
  console.log('🧹 Performing suite-level cleanup...');

  try {
    // First kill any remaining Electron processes
    await killElectronProcesses();

    // Only clean up the test apps if PRESERVE_TEMP_DIR is not set to 'true'
    if (process.env.PRESERVE_TEMP_DIR !== 'true') {
      await testAppsManager.cleanup();
      console.log('✅ Temp directory cleaned up');
    } else {
      console.log('🔒 Preserving temp directory (PRESERVE_TEMP_DIR=true)');
    }

    console.log('✅ Suite cleanup complete');
  } catch (error) {
    console.error('❌ Suite cleanup failed:', error);
    process.exit(1);
  }
}

// Register cleanup handlers for process termination
process.on('exit', () => {
  console.log('Process exiting, cleaning up...');
});

['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
  process.on(signal, async () => {
    console.log(`Received ${signal}, cleaning up...`);
    await cleanupTestSuite();
    process.exit(0);
  });
});

// Export functions for use in other scripts
export { setupTestSuite, cleanupTestSuite };

// If this script is run directly, perform setup
// In ES modules, we check if the current file is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTestSuite().catch((error) => {
    console.error('Error in suite setup:', error);
    process.exit(1);
  });
}
